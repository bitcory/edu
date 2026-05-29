"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FabricObject } from "fabric";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Circle as CircleIcon,
  Copy as CopyIcon,
  Image as ImageIcon,
  Maximize2,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  Palette,
  Columns2,
  Files,
  Home,
  Plus,
  Redo2,
  Save,
  SlidersHorizontal,
  Undo2,
  Square as SquareIcon,
  Trash2,
  Type as TypeIcon,
  X,
} from "lucide-react";
import FabricCanvas, {
  type FabricApi,
  type Guide,
} from "./FabricCanvas";
import ColorField from "./ColorField";
import {
  type EditorPage,
  PAGE_H,
  makePage,
} from "../../lib/editor-types";
import type { BookLayout } from "../../lib/book-types";
import { TEMPLATES } from "../../lib/templates";
import {
  clearEditorState,
  loadEditorState,
  saveEditorState,
} from "../../lib/editor-storage";
import {
  DEFAULT_FONT,
  ensureFont,
  groupFonts,
  preloadAllFonts,
} from "../../lib/fonts";

/** "#rrggbb" → [r,g,b]. */
function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const n = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const int = parseInt(n || "000000", 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/** Build an rgba() string from a hex color + opacity percent. */
function rgbaStr(hex: string, opacityPct: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${(opacityPct / 100).toFixed(3)})`;
}

/** Parse a CSS color (hex or rgba) into a hex + alpha for the UI controls. */
function parseColorToHexAlpha(color?: string): { hex: string; alpha: number } {
  if (!color) return { hex: "#000000", alpha: 0.45 };
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(",").map((s) => s.trim());
    const toHex = (v: string) =>
      Math.max(0, Math.min(255, Math.round(Number(v))))
        .toString(16)
        .padStart(2, "0");
    const alpha = p[3] !== undefined ? Number(p[3]) : 1;
    return { hex: `#${toHex(p[0])}${toHex(p[1])}${toHex(p[2])}`, alpha };
  }
  if (color.startsWith("#")) {
    return { hex: color.slice(0, 7), alpha: 1 };
  }
  return { hex: "#000000", alpha: 0.45 };
}

/**
 * If a data URL's image is larger than maxDim on its longest side, re-encode
 * it as JPEG at the capped size. Returns the original URL if no downscale is
 * needed. Keeps memory predictable when users drop in 4000×3000 phone photos.
 */
async function downscaleImageDataUrl(
  dataUrl: string,
  maxDim: number,
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("image decode failed"));
    el.src = dataUrl;
  });
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longest > maxDim ? maxDim / longest : 1;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  // JPEG has no alpha — converting a transparent image to JPEG fills the
  // see-through areas with black. So keep PNG whenever the image has any
  // transparent pixel (stickers/cutouts); only re-encode fully-opaque images
  // (photos/screenshots) to JPEG when large (4-6× smaller).
  let hasAlpha = false;
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        hasAlpha = true;
        break;
      }
    }
  } catch {
    hasAlpha = true; // can't inspect → assume transparency, keep PNG
  }
  const png = canvas.toDataURL("image/png");
  if (hasAlpha || png.length <= 700_000) return png;
  return canvas.toDataURL("image/jpeg", 0.85);
}

type Props = {
  onFinish: (
    pages: EditorPage[],
    pageW: number,
    layout: BookLayout,
  ) => Promise<void> | void;
  // 임시저장: persist the current pages as a private draft (cloud). May throw
  // on failure (the editor shows the message). Optional so the editor still
  // works without a draft host.
  onSaveDraft?: (
    pages: EditorPage[],
    pageW: number,
    layout: BookLayout,
  ) => Promise<void> | void;
  exporting?: boolean;
  // When editing an existing bookstore book (/edit?book=<id>), seed from its
  // snapshot instead of the localStorage working draft. The parent remounts
  // the Editor (via key) when this changes, so the seeders below re-run.
  initialPages?: EditorPage[];
  // Per-book 판형: page width (height fixed at PAGE_H) + reading layout. The
  // parent remounts the Editor (keyed by pageW) when these change.
  pageW: number;
  // The width before a 판형 change (equals pageW except right after the user
  // switches 판형) — lets us re-center centered content for the new width.
  prevPageW: number;
  layout: BookLayout;
  onTemplateChange: (pageW: number, layout: BookLayout) => void;
};

export default function Editor({
  onFinish,
  onSaveDraft,
  exporting = false,
  initialPages,
  pageW,
  prevPageW,
  layout,
  onTemplateChange,
}: Props) {
  // Shadow PAGE_W with the per-book width so all the body coordinate math uses
  // the chosen 판형. Height stays PAGE_H. The parent remounts on 판형 change.
  const PAGE_W = pageW;
  // Restore the previous session if present (Editor is client-only via
  // dynamic({ ssr: false }) so localStorage access here is safe).
  const [pages, setPages] = useState<EditorPage[]>(() => {
    if (initialPages && initialPages.length > 0) return initialPages;
    const saved = loadEditorState();
    if (saved && saved.pages.length > 0) return saved.pages;
    return [{ ...makePage("cover") }, { ...makePage("content") }];
  });
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    if (initialPages && initialPages.length > 0) return 0;
    const saved = loadEditorState();
    return saved && saved.pages.length > 0
      ? Math.min(saved.activeIndex, saved.pages.length - 1)
      : 0;
  });
  const [selected, setSelected] = useState<FabricObject | null>(null);
  // Mobile: the page list is a left slide-out drawer and the properties panel
  // is a right slide-out drawer, each toggled by a topbar button. On desktop
  // both are always-visible in the grid and these are ignored.
  const [pagelistOpen, setPagelistOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  // Collapsible 외곽선/그림자 sections.
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [shadowOpen, setShadowOpen] = useState(true);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [_changeTick, setChangeTick] = useState(0);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [spreadMode, setSpreadMode] = useState(false);
  const [partnerPng, setPartnerPng] = useState<string | null>(null);

  // In the book viewer: page 0 is the cover (alone on the right), then pages
  // 1+2 form the first spread (1 left, 2 right), 3+4 the next, and so on.
  // Compute the partner page that should sit next to the active one in
  // spread mode. Cover and unpaired tail pages have no partner.
  const partnerIndex = useMemo<number | null>(() => {
    if (!spreadMode) return null;
    if (activeIndex === 0) return null;
    if (activeIndex % 2 === 1) {
      const next = activeIndex + 1;
      return next < pages.length ? next : null;
    }
    return activeIndex - 1;
  }, [spreadMode, activeIndex, pages.length]);

  const apiRef = useRef<FabricApi | null>(null);
  // The active page's thumbnail — scrolled into view when it changes (e.g. on
  // "추가" the new empty page appends to the end and we scroll it into sight).
  const activeThumbRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  // Refs so the debounced snapshot callback can read the latest active page
  // index without re-binding (which would clear the pending timer).
  const activeIndexRef = useRef(activeIndex);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Keep the active page's thumbnail in view — so adding a page (which appends
  // and activates a new empty page) scrolls the list to reveal it.
  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [activeIndex, pages.length]);
  const snapshotTimerRef = useRef<number | null>(null);

  // Per-page undo/redo history. Keyed by page id so switching pages preserves
  // each page's own history. We store serialized canvas JSON snapshots.
  // 20 keeps memory usable when pages contain large base64 images (a typical
  // 1600×900 photo is ~2 MB per snapshot).
  const HISTORY_LIMIT = 20;
  type PageHistory = { past: object[]; future: object[] };
  const historyRef = useRef<Map<string, PageHistory>>(new Map());
  // When true, snapshot pushes are skipped — used to keep the snapshot
  // debounce from re-recording the same state we just applied via undo/redo.
  const isApplyingHistoryRef = useRef(false);
  // Bump to re-render undo/redo button disabled states.
  const [historyTick, setHistoryTick] = useState(0);
  const getHistory = useCallback((pageId: string): PageHistory => {
    let h = historyRef.current.get(pageId);
    if (!h) {
      h = { past: [], future: [] };
      historyRef.current.set(pageId, h);
    }
    return h;
  }, []);

  // Display scale: backing canvas is fixed PAGE_W x PAGE_H, displayed scaled to fit.
  // In spread mode with a partner, two pages sit side by side, so we fit a
  // 2*PAGE_W rectangle instead.
  const [displayScale, setDisplayScale] = useState(1);
  // Capture the latest "fit for spread" state without re-binding the observer.
  const fitSpreadRef = useRef(false);
  useEffect(() => {
    fitSpreadRef.current = spreadMode && partnerIndex !== null;
  }, [spreadMode, partnerIndex]);
  useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const compute = () => {
      const availW = el.clientWidth - 24;
      const availH = el.clientHeight - 24;
      const totalW = fitSpreadRef.current ? PAGE_W * 2 : PAGE_W;
      const s = Math.min(availW / totalW, availH / PAGE_H);
      setDisplayScale(Math.max(0.1, s));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Recompute when spread/partner toggles change.
  useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const availW = el.clientWidth - 24;
    const availH = el.clientHeight - 24;
    const totalW = spreadMode && partnerIndex !== null ? PAGE_W * 2 : PAGE_W;
    const s = Math.min(availW / totalW, availH / PAGE_H);
    setDisplayScale(Math.max(0.1, s));
  }, [spreadMode, partnerIndex]);

  // Auto-save pages + activeIndex to localStorage so closing the tab or
  // jumping to the book viewer and back doesn't lose work. Debounced so
  // dragging a single object doesn't write to storage 60 times a second.
  useEffect(() => {
    const id = window.setTimeout(() => {
      saveEditorState({
        pages,
        activeIndex,
        savedAt: Date.now(),
        pageW,
        layout,
      });
    }, 500);
    return () => window.clearTimeout(id);
  }, [pages, activeIndex, pageW, layout]);

  // Snapshot the live Fabric canvas into pages[activeIndex] (debounced) so
  // edits within a single page are persisted too — not only structural
  // changes like add/remove. Without this, only "switch page" actions would
  // commit the canvas into the pages state.
  // Also push the snapshot to the active page's undo history (unless we're
  // currently applying an undo/redo, which would otherwise re-record itself).
  const handleCanvasChange = useCallback(() => {
    setChangeTick((x) => x + 1);
    if (snapshotTimerRef.current !== null) {
      window.clearTimeout(snapshotTimerRef.current);
    }
    snapshotTimerRef.current = window.setTimeout(() => {
      const api = apiRef.current;
      if (!api) return;
      const idx = activeIndexRef.current;
      const data = api.serialize();
      const thumb = api.toPng(0.2);
      setPages((prev) => {
        const pageId = prev[idx]?.id;
        if (pageId && !isApplyingHistoryRef.current) {
          const h = getHistory(pageId);
          // Skip dedup: each snapshot represents a meaningful edit (Fabric
          // only fires modified/added/removed on actual user actions). Doing
          // JSON.stringify here was blocking the main thread for tens of ms
          // on pages with images, contributing to perceived freezing.
          h.past.push(data);
          if (h.past.length > HISTORY_LIMIT) h.past.shift();
          h.future = []; // any new edit clears the redo branch
          setHistoryTick((t) => t + 1);
        }
        return prev.map((p, i) => (i === idx ? { ...p, data, thumb } : p));
      });
    }, 700);
  }, [getHistory]);

  const canUndo = useMemo(() => {
    void historyTick;
    const pageId = pages[activeIndex]?.id;
    if (!pageId) return false;
    const h = historyRef.current.get(pageId);
    return !!h && h.past.length > 1;
  }, [historyTick, pages, activeIndex]);

  const canRedo = useMemo(() => {
    void historyTick;
    const pageId = pages[activeIndex]?.id;
    if (!pageId) return false;
    const h = historyRef.current.get(pageId);
    return !!h && h.future.length > 0;
  }, [historyTick, pages, activeIndex]);

  const undo = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const pageId = pages[activeIndex]?.id;
    if (!pageId) return;
    const h = getHistory(pageId);
    if (h.past.length < 2) return;
    // Pop current state into the future branch; restore the previous state.
    const current = h.past.pop();
    if (current) h.future.push(current);
    const prev = h.past[h.past.length - 1];
    if (!prev) return;
    isApplyingHistoryRef.current = true;
    if (snapshotTimerRef.current !== null) {
      window.clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
    }
    await api.load(prev);
    setPages((p) =>
      p.map((pg, i) =>
        i === activeIndex
          ? { ...pg, data: prev, thumb: api.toPng(0.2) }
          : pg,
      ),
    );
    setSelected(null);
    setHistoryTick((t) => t + 1);
    isApplyingHistoryRef.current = false;
  }, [pages, activeIndex, getHistory]);

  const redo = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const pageId = pages[activeIndex]?.id;
    if (!pageId) return;
    const h = getHistory(pageId);
    if (h.future.length === 0) return;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(next);
    isApplyingHistoryRef.current = true;
    if (snapshotTimerRef.current !== null) {
      window.clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
    }
    await api.load(next);
    setPages((p) =>
      p.map((pg, i) =>
        i === activeIndex
          ? { ...pg, data: next, thumb: api.toPng(0.2) }
          : pg,
      ),
    );
    setSelected(null);
    setHistoryTick((t) => t + 1);
    isApplyingHistoryRef.current = false;
  }, [pages, activeIndex, getHistory]);

  // Keyboard shortcuts: Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z (or Ctrl+Y) = redo.
  // Skip when the user is editing text inline inside a Fabric IText (the
  // canvas captures keystrokes for text editing in that mode).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const editing =
        (
          apiRef.current?.canvas?.getActiveObject() as
            | { isEditing?: boolean }
            | null
            | undefined
        )?.isEditing;
      if (editing) return;
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        void undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        void redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Discard everything and start a fresh book.
  const resetEditor = useCallback(() => {
    if (
      !window.confirm(
        "지금까지 만든 책을 모두 지우고 새로 시작할까요? 되돌릴 수 없어요.",
      )
    ) {
      return;
    }
    clearEditorState();
    window.location.reload();
  }, []);

  // Memoize the partner page's data so the PNG-render effect doesn't re-run
  // on EVERY pages mutation (snapshots while editing the active page would
  // otherwise constantly thrash an expensive offscreen render and cause the
  // UI to flicker / "shake"). The returned reference only changes when the
  // partner's own data slot actually changes.
  const partnerData = useMemo(() => {
    if (partnerIndex === null) return null;
    return pages[partnerIndex]?.data ?? null;
  }, [partnerIndex, pages]);

  useEffect(() => {
    if (!spreadMode || partnerIndex === null) {
      setPartnerPng(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const fabric = await import("fabric");
      const offEl = document.createElement("canvas");
      offEl.width = PAGE_W;
      offEl.height = PAGE_H;
      const off = new fabric.StaticCanvas(offEl, {
        width: PAGE_W,
        height: PAGE_H,
        backgroundColor: "#ffffff",
      });
      if (partnerData) {
        await off.loadFromJSON(partnerData);
      }
      off.renderAll();
      const png = off.toDataURL({ format: "png", multiplier: 1 });
      off.dispose();
      if (!cancelled) setPartnerPng(png);
    })();
    return () => {
      cancelled = true;
    };
  }, [spreadMode, partnerIndex, partnerData]);

  const handleReady = useCallback(async (api: FabricApi) => {
    apiRef.current = api;
    // Preload fonts so the Fabric canvas renders the right glyphs.
    await preloadAllFonts();
    const activePage = pages[activeIndex];
    if (activePage?.data) {
      // Restored from storage (or any non-blank page) — load it in.
      await api.load(activePage.data);
      const c = api.canvas;
      if (c) setBgColor((c.backgroundColor as string) || "#ffffff");
    } else {
      await api.load(null);
      // Seed cover with title + subtitle placeholders if blank.
      if (activePage?.kind === "cover") {
        const fabric = await import("fabric");
        if (!api.canvas) return;
        api.canvas.backgroundColor = "#fff3c2";
        const title = new fabric.IText("내 그림책 제목", {
          left: PAGE_W / 2,
          top: PAGE_H * 0.18,
          originX: "center",
          fontSize: 84,
          fontFamily: DEFAULT_FONT.family,
          fontWeight: "bold",
          fill: "#3a2415",
          textAlign: "center",
        });
        const sub = new fabric.IText("부제 또는 지은이", {
          left: PAGE_W / 2,
          top: PAGE_H * 0.3,
          originX: "center",
          fontSize: 36,
          fontFamily: DEFAULT_FONT.family,
          fill: "#6a4a2b",
          textAlign: "center",
        });
        api.canvas.add(title);
        api.canvas.add(sub);
        api.canvas.renderAll();
        setBgColor("#fff3c2");
      }
    }

    // 판형(폭)이 바뀐 채로 다시 마운트되면, 가운데 정렬 요소(표지 제목·부제 등)를
    // 새 폭의 중앙으로 다시 맞춘다.
    if (prevPageW !== PAGE_W && api.canvas) {
      let moved = false;
      for (const o of api.canvas.getObjects()) {
        if ((o as unknown as { originX?: string }).originX === "center") {
          o.set({ left: PAGE_W / 2 });
          o.setCoords();
          moved = true;
        }
      }
      if (moved) {
        api.canvas.requestRenderAll();
        const data = api.serialize();
        const thumb = api.toPng(0.2);
        const idx = activeIndexRef.current;
        const w = PAGE_W;
        setPages((prev) =>
          prev.map((pg, i) =>
            i === idx
              ? { ...pg, data, thumb }
              : { ...pg, data: recenterCenterObjects(pg.data, w) },
          ),
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save current page data + update thumbnail.
  const snapshotCurrent = useCallback((): EditorPage[] | null => {
    const api = apiRef.current;
    if (!api) return null;
    const data = api.serialize();
    const thumb = api.toPng(0.2);
    setPages((prev) =>
      prev.map((p, i) =>
        i === activeIndex ? { ...p, data, thumb } : p,
      ),
    );
    return null;
  }, [activeIndex]);

  // Switch to a different page.
  const switchTo = useCallback(
    async (newIndex: number) => {
      if (newIndex === activeIndex) return;
      const api = apiRef.current;
      if (!api) return;
      const data = api.serialize();
      const thumb = api.toPng(0.2);
      setPages((prev) => {
        const next = prev.map((p, i) =>
          i === activeIndex ? { ...p, data, thumb } : p,
        );
        return next;
      });
      await api.load(pages[newIndex]?.data ?? null);
      const c = api.canvas;
      if (c) {
        setBgColor((c.backgroundColor as string) || "#ffffff");
      }
      setSelected(null);
      setActiveIndex(newIndex);
    },
    [activeIndex, pages],
  );

  // Tools: add text / image / rect / circle.
  const addText = useCallback(async () => {
    const api = apiRef.current;
    if (!api?.canvas) return;
    const fabric = await import("fabric");
    // On the RIGHT page of a spread, default new text to right-aligned and
    // pinned to the right edge (mirrors the left page's left default).
    const idx = activeIndexRef.current;
    const isRightPage = layout === "spread" && idx >= 2 && idx % 2 === 0;
    const t = new fabric.IText("여기에 글자를 적어요", {
      top: 80,
      fontSize: 48,
      fontFamily: DEFAULT_FONT.family,
      fill: "#2c1d10",
      editable: true,
      lineHeight: 1.5,
      textAlign: isRightPage ? "right" : "left",
      ...(isRightPage
        ? { originX: "right" as const, left: PAGE_W - 80 }
        : { left: 80 }),
    });
    api.canvas.add(t);
    api.canvas.setActiveObject(t);
    api.canvas.requestRenderAll();
  }, [layout, PAGE_W]);

  const addImageFile = useCallback(async (file: File) => {
    const api = apiRef.current;
    if (!api?.canvas) return;
    const fabric = await import("fabric");
    const rawUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(file);
    });
    // Downscale very large images on import so each one doesn't bloat the
    // canvas state (and the undo history × each snapshot × auto-save). Cap
    // at 2× the page dimensions — more than enough for a continuous spread.
    const MAX_DIM = Math.max(PAGE_W, PAGE_H) * 2;
    const url = await downscaleImageDataUrl(rawUrl, MAX_DIM);
    const img = await fabric.FabricImage.fromURL(url, {
      crossOrigin: "anonymous",
    });
    const iw = img.width ?? PAGE_W;
    const ih = img.height ?? PAGE_H;
    img.set({
      scaleX: 1,
      scaleY: 1,
      left: (PAGE_W - iw) / 2,
      top: (PAGE_H - ih) / 2,
    });
    api.canvas.add(img);
    api.canvas.setActiveObject(img);
    api.canvas.requestRenderAll();
  }, []);

  const addShape = useCallback(
    async (kind: "rect" | "circle") => {
      const api = apiRef.current;
      if (!api?.canvas) return;
      const fabric = await import("fabric");
      const shape =
        kind === "rect"
          ? new fabric.Rect({
              left: 120,
              top: 120,
              width: 240,
              height: 160,
              fill: "#ffffff",
              rx: 14,
              ry: 14,
            })
          : new fabric.Circle({
              left: 200,
              top: 200,
              radius: 110,
              fill: "#7b74d9",
            });
      api.canvas.add(shape);
      api.canvas.setActiveObject(shape);
      api.canvas.requestRenderAll();
    },
    [],
  );

  const setBg = useCallback((color: string) => {
    const api = apiRef.current;
    if (!api?.canvas) return;
    api.canvas.backgroundColor = color;
    api.canvas.requestRenderAll();
    setBgColor(color);
    setChangeTick((x) => x + 1);
  }, []);

  // PageList operations
  const addPage = useCallback(async () => {
    const api = apiRef.current;
    // Snapshot current page before switching so its edits aren't lost.
    if (api) {
      const data = api.serialize();
      const thumb = api.toPng(0.2);
      const idx = activeIndexRef.current;
      setPages((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, data, thumb } : p)),
      );
    }
    const newPage = makePage("content");
    setPages((p) => {
      const next = [...p, newPage];
      // Jump to the newly appended page.
      setActiveIndex(next.length - 1);
      return next;
    });
    if (api) {
      await api.load(null);
      setSelected(null);
      setBgColor("#ffffff");
    }
  }, []);

  const removePage = useCallback(
    async (idx: number) => {
      if (pages.length <= 1) return;
      // If removing current, switch first.
      const newActive =
        idx === activeIndex
          ? Math.max(0, idx - 1)
          : idx < activeIndex
            ? activeIndex - 1
            : activeIndex;
      const api = apiRef.current;
      if (idx === activeIndex && api) {
        await api.load(pages[newActive]?.data ?? null);
      }
      setPages((p) => p.filter((_, i) => i !== idx));
      setActiveIndex(newActive);
    },
    [pages, activeIndex],
  );

  const movePage = useCallback(
    (idx: number, dir: -1 | 1) => {
      const j = idx + dir;
      if (j < 0 || j >= pages.length) return;
      setPages((p) => {
        const next = [...p];
        [next[idx], next[j]] = [next[j], next[idx]];
        return next;
      });
      if (activeIndex === idx) setActiveIndex(j);
      else if (activeIndex === j) setActiveIndex(idx);
    },
    [pages, activeIndex],
  );

  // Drag-and-drop reordering: track the index being dragged and the current
  // drop target index (the slot where the dragged page would land, with
  // insert-before semantics).
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  const reorderPage = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const activeId = pages[activeIndex]?.id;
      setPages((prev) => {
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        // Insert-before: when source was before destination, account for the
        // shift caused by the removal.
        const adjusted = from < to ? to - 1 : to;
        next.splice(adjusted, 0, moved);
        // Re-find the active page's new index.
        if (activeId) {
          const newActive = next.findIndex((p) => p.id === activeId);
          if (newActive >= 0) setActiveIndex(newActive);
        }
        return next;
      });
    },
    [pages, activeIndex],
  );

  /**
   * Duplicate a page. The source page is NEVER mutated — the two pages
   * operate completely independently. For a wide image (scaledW > PAGE_W)
   * aligned to one edge, the copy reveals the adjacent half so the pages form
   * a continuous spread:
   *   • 왼쪽 정렬(left half)  → copy = right half, inserted AFTER
   *   • 오른쪽 정렬(right half) → copy = left half, inserted BEFORE
   * Align the source's image with the 왼쪽/오른쪽 button (or drag to an edge)
   * first. Images not edge-aligned just copy in place.
   */
  const duplicatePage = useCallback(
    async (idx: number) => {
      const api = apiRef.current;
      if (!api) return;

      // 1) Snapshot the source (if it's the active page) so any unsaved
      //    edits are captured before cloning.
      let source = pages[idx];
      if (idx === activeIndex) {
        const data = api.serialize();
        const thumb = api.toPng(0.2);
        source = { ...source, data, thumb };
      }

      // 2) Deep-clone the source data for the new page. Source data stays
      //    untouched — JSON round-trip guarantees no shared references.
      const clonedData = source.data
        ? (JSON.parse(JSON.stringify(source.data)) as {
            objects?: Array<Record<string, unknown>>;
          })
        : null;

      // 3) Spread auto-shift (opt-in): for a wide image the user has aligned to
      //    one edge, the copy reveals the *adjacent* half so the two pages form
      //    a continuous spread:
      //      • left-aligned (left half)  → copy = right half, placed AFTER
      //      • right-aligned (right half) → copy = left half, placed BEFORE
      //    Otherwise the copy keeps the same position (image stays in place).
      let insertBefore = false;
      let directionDecided = false;
      if (clonedData?.objects) {
        for (const obj of clonedData.objects) {
          const type = obj.type as string | undefined;
          if (type !== "image" && type !== "Image") continue;
          const baseW = Number(obj.width ?? 0);
          const scaleX = Number(obj.scaleX ?? 1);
          const left = Number(obj.left ?? 0);
          const scaledW = baseW * scaleX;
          if (scaledW <= PAGE_W + 1) continue;
          if (Math.abs(left) < 1) {
            // left half → reveal the right half on the copy (after)
            obj.left = -PAGE_W;
            if (!directionDecided) {
              insertBefore = false;
              directionDecided = true;
            }
          } else if (Math.abs(left + scaledW - PAGE_W) < 1) {
            // right half → reveal the left half on the copy (before)
            obj.left = left + PAGE_W;
            if (!directionDecided) {
              insertBefore = true;
              directionDecided = true;
            }
          }
        }
      }

      // 4) Commit: keep source as-is (with snapshot if needed) and insert
      //    the cloned page right after it.
      const newPage: EditorPage = {
        id: Math.random().toString(36).slice(2, 10),
        kind: "content",
        data: clonedData,
      };
      // Right-aligned source → the left-half copy goes BEFORE the source so the
      // spread reads [left half][right half]; otherwise after.
      const insertAt = insertBefore ? idx : idx + 1;
      setPages((prev) => {
        const next =
          idx === activeIndex
            ? prev.map((p, i) => (i === idx ? source : p))
            : prev;
        return [
          ...next.slice(0, insertAt),
          newPage,
          ...next.slice(insertAt),
        ];
      });

      // 5) Switch to the new page.
      await api.load(clonedData);
      setActiveIndex(insertAt);

      // 6) Auto-select the first image on the new page so the user sees its
      //    bounding box right away.
      const c = api.canvas;
      if (c) {
        const firstImage = c
          .getObjects()
          .find((o) => o.type === "image" || o.type === "Image");
        if (firstImage) {
          c.setActiveObject(firstImage);
          c.requestRenderAll();
          setSelected(firstImage);
        } else {
          setSelected(null);
        }
      }
    },
    [pages, activeIndex],
  );

  // Selection helpers
  const updateSelected = useCallback(
    (patch: Record<string, unknown>) => {
      const api = apiRef.current;
      if (!api?.canvas || !selected) return;
      selected.set(patch);
      api.canvas.requestRenderAll();
      setChangeTick((x) => x + 1);
    },
    [selected],
  );

  // Drop shadow on the selected object (fabric.Shadow). Pass null to clear.
  const applyShadowParams = useCallback(
    async (p: {
      on: boolean;
      hex: string;
      opacity: number;
      angle: number;
      distance: number;
      blur: number;
    }) => {
      const api = apiRef.current;
      if (!api?.canvas || !selected) return;
      if (!p.on) {
        selected.set("shadow", null);
      } else {
        const fabric = await import("fabric");
        const rad = (p.angle * Math.PI) / 180;
        selected.set(
          "shadow",
          new fabric.Shadow({
            color: rgbaStr(p.hex, p.opacity),
            blur: p.blur,
            offsetX: Math.round(Math.cos(rad) * p.distance),
            offsetY: Math.round(Math.sin(rad) * p.distance),
          }),
        );
      }
      api.canvas.requestRenderAll();
      setChangeTick((x) => x + 1);
    },
    [selected],
  );

  const deleteSelected = useCallback(() => {
    const api = apiRef.current;
    if (!api?.canvas || !selected) return;
    api.canvas.remove(selected);
    setSelected(null);
  }, [selected]);

  /**
   * Fit the selected object to a preset:
   *
   *   • 전체  — RESCALE: fill page height, center. The only preset that
   *             changes scaleX/scaleY (user explicit "fill page" intent).
   *   • 위 / 아래 / 왼쪽 / 오른쪽  — ALIGN-ONLY: keep current scale, just
   *             pin the corresponding edge of the object to that edge of
   *             the page. Lets users size first (via 전체 or manual drag)
   *             and then nudge to a side without shrinking.
   */
  type FitPreset = {
    key: "full" | "top" | "bottom" | "left" | "right";
    /** Whether this preset recomputes scale. Only "full" does. */
    rescale: boolean;
    hPin: "left" | "center" | "right";
    vPin: "top" | "center" | "bottom";
  };

  const fitToPreset = useCallback(
    (p: FitPreset) => {
      const api = apiRef.current;
      if (!api?.canvas || !selected) return;

      if (p.rescale) {
        const baseH = (selected as unknown as { height?: number }).height ?? 1;
        const scale = PAGE_H / baseH;
        selected.set({ scaleX: scale, scaleY: scale, angle: 0 });
      }
      selected.setCoords();
      const r = selected.getBoundingRect();

      let targetCx: number;
      if (p.hPin === "left") targetCx = r.width / 2;
      else if (p.hPin === "right") targetCx = PAGE_W - r.width / 2;
      else targetCx = PAGE_W / 2;

      let targetCy: number;
      if (p.vPin === "top") targetCy = r.height / 2;
      else if (p.vPin === "bottom") targetCy = PAGE_H - r.height / 2;
      else targetCy = PAGE_H / 2;

      const curCx = r.left + r.width / 2;
      const curCy = r.top + r.height / 2;
      selected.set({
        left: (selected.left ?? 0) + (targetCx - curCx),
        top: (selected.top ?? 0) + (targetCy - curCy),
      });
      selected.setCoords();
      api.canvas.requestRenderAll();
      setChangeTick((x) => x + 1);
    },
    [selected],
  );

  const FIT_PRESETS = useMemo(
    () =>
      [
        {
          key: "full",
          label: "전체",
          Icon: Maximize2,
          preset: {
            key: "full",
            rescale: true,
            hPin: "center",
            vPin: "center",
          },
        },
        {
          key: "top",
          label: "위",
          Icon: PanelTop,
          preset: {
            key: "top",
            rescale: false,
            hPin: "center",
            vPin: "top",
          },
        },
        {
          key: "bottom",
          label: "아래",
          Icon: PanelBottom,
          preset: {
            key: "bottom",
            rescale: false,
            hPin: "center",
            vPin: "bottom",
          },
        },
        {
          key: "left",
          label: "왼쪽",
          Icon: PanelLeft,
          preset: {
            key: "left",
            rescale: false,
            hPin: "left",
            vPin: "center",
          },
        },
        {
          key: "right",
          label: "오른쪽",
          Icon: PanelRight,
          preset: {
            key: "right",
            rescale: false,
            hPin: "right",
            vPin: "center",
          },
        },
      ] as const satisfies ReadonlyArray<{
        key: string;
        label: string;
        Icon: typeof Maximize2;
        preset: FitPreset;
      }>,
    [],
  );

  const layerAction = useCallback(
    (action: "forward" | "backward" | "front" | "back") => {
      const api = apiRef.current;
      if (!api?.canvas || !selected) return;
      const c = api.canvas;
      if (action === "forward") c.bringObjectForward(selected);
      else if (action === "backward") c.sendObjectBackwards(selected);
      else if (action === "front") c.bringObjectToFront(selected);
      else c.sendObjectToBack(selected);
      c.requestRenderAll();
    },
    [selected],
  );

  // Finish: snapshot current, hand all pages to parent.
  const handleFinish = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const data = api.serialize();
    const thumb = api.toPng(0.2);
    const finalPages = pages.map((p, i) =>
      i === activeIndex ? { ...p, data, thumb } : p,
    );
    setPages(finalPages);
    await onFinish(finalPages, pageW, layout);
  }, [pages, activeIndex, onFinish, pageW, layout]);

  // 임시저장: snapshot the current page, then hand all pages to the parent to
  // persist as a cloud draft. Shows a transient "저장됨 ✓" on success.
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const handleSaveDraft = useCallback(async () => {
    if (!onSaveDraft) return;
    const api = apiRef.current;
    if (!api) return;
    const data = api.serialize();
    const thumb = api.toPng(0.2);
    const finalPages = pages.map((p, i) =>
      i === activeIndex ? { ...p, data, thumb } : p,
    );
    setPages(finalPages);
    setDraftState("saving");
    try {
      await onSaveDraft(finalPages, pageW, layout);
      setDraftState("saved");
      window.setTimeout(() => setDraftState("idle"), 2000);
    } catch (err) {
      setDraftState("idle");
      alert((err as Error).message);
    }
  }, [pages, activeIndex, onSaveDraft, pageW, layout]);

  // Close the mobile properties drawer (keeps the canvas selection so the user
  // can reopen "편집하기" to keep editing the same object).
  const closeProps = useCallback(() => setPropsOpen(false), []);

  const isText = useMemo(
    () => selected?.type === "i-text" || selected?.type === "text",
    [selected],
  );
  const isShape = useMemo(
    () => selected?.type === "rect" || selected?.type === "circle",
    [selected],
  );
  const isImage = useMemo(() => selected?.type === "image", [selected]);
  const canFit = isImage || isShape;

  // Outline + shadow state for the text props UI (re-derived each render).
  const strokeColor =
    (selected as unknown as { stroke?: string } | null)?.stroke || "#ffffff";
  const strokeWidth =
    (selected as unknown as { strokeWidth?: number } | null)?.strokeWidth ?? 0;
  const outlineOn = strokeWidth > 0;

  const _shadow = (
    selected as unknown as {
      shadow?: { color?: string; blur?: number; offsetX?: number; offsetY?: number };
    } | null
  )?.shadow;
  const shadowOn = !!_shadow;
  const _shCol = parseColorToHexAlpha(_shadow?.color);
  const shadow = {
    on: shadowOn,
    hex: _shCol.hex,
    opacity: Math.round(_shCol.alpha * 100),
    blur: Math.round(_shadow?.blur ?? 6),
    distance: Math.round(
      Math.hypot(_shadow?.offsetX ?? 3, _shadow?.offsetY ?? 3),
    ),
    angle:
      (((Math.round(
        (Math.atan2(_shadow?.offsetY ?? 3, _shadow?.offsetX ?? 3) * 180) /
          Math.PI,
      ) %
        360) +
        360) %
        360),
  };

  return (
    <div className="ed-shell">
      <div className="ed-topbar">
        <Link
          href="/"
          className="ed-home ed-home--icon"
          aria-label="처음으로"
          title="처음으로"
        >
          <Home size={18} strokeWidth={2} />
        </Link>
        <button
          type="button"
          className="ed-home"
          onClick={resetEditor}
          title="저장된 작업을 지우고 빈 책으로 시작"
        >
          <Trash2 size={14} /> 새 책
        </button>
        <button
          type="button"
          className="ed-pagelist-toggle"
          onClick={() => setPagelistOpen(true)}
          title="페이지 목록 열기"
          aria-label="페이지 목록 열기"
        >
          <Files size={14} /> 페이지
        </button>
        <button
          type="button"
          className={`ed-props-toggle${selected ? " is-active" : ""}`}
          onClick={() => setPropsOpen(true)}
          title="선택한 요소 편집하기"
          aria-label="편집하기"
        >
          <SlidersHorizontal size={14} /> 편집하기
        </button>
        <div className="ed-tools">
          <button type="button" className="ed-tool" onClick={addText}>
            <TypeIcon size={16} /> 글자
          </button>
          <button
            type="button"
            className="ed-tool"
            onClick={() => imgInputRef.current?.click()}
          >
            <ImageIcon size={16} /> 그림
            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void addImageFile(f);
                e.target.value = "";
              }}
            />
          </button>
          <button
            type="button"
            className="ed-tool"
            onClick={() => addShape("rect")}
          >
            <SquareIcon size={16} /> 네모
          </button>
          <button
            type="button"
            className="ed-tool"
            onClick={() => addShape("circle")}
          >
            <CircleIcon size={16} /> 동그라미
          </button>
          <span className="ed-tool ed-tool--bg">
            <Palette size={16} /> 배경
            <ColorField
              value={bgColor}
              onChange={setBg}
              className="ed-bg-swatch"
            />
          </span>
          <select
            className="ed-tool-select"
            value={pageW}
            onChange={(e) => {
              const t = TEMPLATES.find(
                (tpl) => tpl.width === Number(e.target.value),
              );
              if (t) onTemplateChange(t.width, t.layout);
            }}
            title="판형 (그림책 크기)"
          >
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.width}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`ed-tool${spreadMode ? " is-active" : ""}`}
            onClick={() => setSpreadMode((v) => !v)}
            title="펼침면 미리보기 (좌·우 페이지를 같이 보기)"
          >
            <Columns2 size={16} /> {spreadMode ? "한 페이지" : "스프레드"}
          </button>
        </div>
        <div className="ed-undo-group">
          <button
            type="button"
            className="ed-round-btn"
            onClick={() => void undo()}
            disabled={!canUndo}
            title="되돌리기 (⌘/Ctrl+Z)"
            aria-label="되돌리기"
          >
            <Undo2 size={18} />
          </button>
          <button
            type="button"
            className="ed-round-btn"
            onClick={() => void redo()}
            disabled={!canRedo}
            title="다시 실행 (⌘/Ctrl+Shift+Z)"
            aria-label="다시 실행"
          >
            <Redo2 size={18} />
          </button>
        </div>
        <div className="ed-spacer" />
        {onSaveDraft && (
          <button
            type="button"
            className="ed-draft"
            onClick={() => void handleSaveDraft()}
            disabled={exporting || draftState === "saving"}
            title="작업을 내 서재에 임시저장 (공개 안 됨)"
          >
            <Save size={16} />
            {draftState === "saving"
              ? "저장 중…"
              : draftState === "saved"
                ? "저장됨 ✓"
                : "임시저장"}
          </button>
        )}
        <button
          type="button"
          className="ed-finish"
          onClick={handleFinish}
          disabled={exporting}
        >
          <BookOpen size={16} />
          {exporting ? (
            "책으로 만드는 중…"
          ) : (
            <>
              완성<span className="ed-finish__suffix"> → 책으로</span>
            </>
          )}
        </button>
      </div>

      {pagelistOpen && (
        <div
          className="ed-pagelist-backdrop"
          onClick={() => setPagelistOpen(false)}
          aria-hidden
        />
      )}
      <aside className={`ed-pagelist${pagelistOpen ? " ed-pagelist--open" : ""}`}>
        <div className="ed-pagelist__head">
          <span>페이지</span>
          <button
            type="button"
            className="ed-pagelist__add"
            onClick={() => void addPage()}
          >
            <Plus size={12} /> 추가
          </button>
          <button
            type="button"
            className="ed-pagelist__close"
            onClick={() => setPagelistOpen(false)}
            aria-label="페이지 목록 닫기"
            title="닫기"
          >
            <X size={16} />
          </button>
        </div>
        <div className="ed-pagelist__items">
          {pages.map((p, i) => (
            <div
              key={p.id}
              ref={i === activeIndex ? activeThumbRef : null}
              className={`ed-page-thumb${
                i === activeIndex ? " is-active" : ""
              }${dragSrc === i ? " is-dragging" : ""}${
                dropTarget === i && dragSrc !== null && dragSrc !== i
                  ? " is-drop-target"
                  : ""
              }`}
              onClick={() => {
                void switchTo(i);
                setPagelistOpen(false);
              }}
              style={{ aspectRatio: `${pageW} / ${PAGE_H}` }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
                setDragSrc(i);
              }}
              onDragOver={(e) => {
                if (dragSrc === null || dragSrc === i) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDropTarget(i);
              }}
              onDragLeave={(e) => {
                // Only clear if leaving to a child of a different thumb.
                const related = e.relatedTarget as Node | null;
                if (
                  related &&
                  e.currentTarget.contains(related)
                )
                  return;
                if (dropTarget === i) setDropTarget(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const src = Number(e.dataTransfer.getData("text/plain"));
                if (!Number.isNaN(src) && src !== i) {
                  reorderPage(src, i);
                }
                setDragSrc(null);
                setDropTarget(null);
              }}
              onDragEnd={() => {
                setDragSrc(null);
                setDropTarget(null);
              }}
            >
              <div className="ed-page-thumb__inner">
                {p.thumb ? (
                  <img src={p.thumb} alt={`page ${i + 1}`} />
                ) : (
                  <span>{i === 0 ? "표지" : `${i}쪽`}</span>
                )}
              </div>
              <span className="ed-page-thumb__label">
                {i === 0 ? "표지" : `${i}쪽`}
              </span>
              {p.kind === "cover" && (
                <span className="ed-page-thumb__cover-badge">표지</span>
              )}
              <div className="ed-page-thumb__actions">
                <button
                  type="button"
                  className="ed-page-thumb__btn"
                  title="복제 (그림이 넓으면 좌우 매칭됨)"
                  onClick={(e) => {
                    e.stopPropagation();
                    void duplicatePage(i);
                  }}
                >
                  <CopyIcon size={14} />
                </button>
                {i > 0 && (
                  <button
                    type="button"
                    className="ed-page-thumb__btn"
                    title="위로"
                    onClick={(e) => {
                      e.stopPropagation();
                      movePage(i, -1);
                    }}
                  >
                    <ChevronUp size={14} />
                  </button>
                )}
                {i < pages.length - 1 && (
                  <button
                    type="button"
                    className="ed-page-thumb__btn"
                    title="아래로"
                    onClick={(e) => {
                      e.stopPropagation();
                      movePage(i, 1);
                    }}
                  >
                    <ChevronDown size={14} />
                  </button>
                )}
                {pages.length > 1 && (
                  <button
                    type="button"
                    className="ed-page-thumb__btn"
                    title="삭제"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removePage(i);
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div
        className={`ed-canvas-wrap${
          spreadMode && partnerIndex !== null ? " ed-canvas-wrap--spread" : ""
        }`}
        ref={stageRef}
      >
        {spreadMode &&
          partnerIndex !== null &&
          partnerIndex < activeIndex && (
            <div
              key="partner-before"
              className="ed-canvas-frame ed-canvas-frame--partner"
              style={{
                width: PAGE_W * displayScale,
                height: PAGE_H * displayScale,
              }}
              onClick={() => void switchTo(partnerIndex)}
              title={`${partnerIndex === 0 ? "표지" : `${partnerIndex}쪽`}으로 이동`}
            >
              {partnerPng ? (
                <img
                  src={partnerPng}
                  alt={`page ${partnerIndex + 1} preview`}
                  draggable={false}
                  style={{ width: "100%", height: "100%", display: "block" }}
                />
              ) : (
                <div className="ed-canvas-frame__placeholder">
                  미리보기 만드는 중…
                </div>
              )}
              <span className="ed-canvas-frame__badge">
                {partnerIndex === 0 ? "표지" : `${partnerIndex}쪽`} · 미리보기
              </span>
            </div>
          )}
        <div
          key="active-frame"
          className="ed-canvas-frame"
          style={{
            width: PAGE_W * displayScale,
            height: PAGE_H * displayScale,
          }}
        >
          <div
            style={{
              width: PAGE_W,
              height: PAGE_H,
              transform: `scale(${displayScale})`,
              transformOrigin: "top left",
            }}
          >
            <FabricCanvas
              pageW={pageW}
              onReady={handleReady}
              onSelection={setSelected}
              onChange={handleCanvasChange}
              onGuides={setGuides}
            />
          </div>
          {guides.map((g, i) =>
            g.axis === "x" ? (
              <div
                key={`gx-${i}-${g.pos}`}
                className="ed-guide ed-guide--x"
                style={{ left: g.pos * displayScale }}
              />
            ) : (
              <div
                key={`gy-${i}-${g.pos}`}
                className="ed-guide ed-guide--y"
                style={{ top: g.pos * displayScale }}
              />
            ),
          )}
        </div>
        {spreadMode &&
          partnerIndex !== null &&
          partnerIndex > activeIndex && (
            <div
              key="partner-after"
              className="ed-canvas-frame ed-canvas-frame--partner"
              style={{
                width: PAGE_W * displayScale,
                height: PAGE_H * displayScale,
              }}
              onClick={() => void switchTo(partnerIndex)}
              title={`${partnerIndex === 0 ? "표지" : `${partnerIndex}쪽`}으로 이동`}
            >
              {partnerPng ? (
                <img
                  src={partnerPng}
                  alt={`page ${partnerIndex + 1} preview`}
                  draggable={false}
                  style={{ width: "100%", height: "100%", display: "block" }}
                />
              ) : (
                <div className="ed-canvas-frame__placeholder">
                  미리보기 만드는 중…
                </div>
              )}
              <span className="ed-canvas-frame__badge">
                {partnerIndex === 0 ? "표지" : `${partnerIndex}쪽`} · 미리보기
              </span>
            </div>
          )}
      </div>

      {propsOpen && (
        <div
          className="ed-props-backdrop"
          onClick={() => setPropsOpen(false)}
          aria-hidden
        />
      )}
      <aside className={`ed-props${propsOpen ? " ed-props--open" : ""}`}>
        <div className="ed-props__bar">
          <h3 className="ed-props__title">속성</h3>
          <button
            type="button"
            className="ed-props__close"
            onClick={closeProps}
            aria-label="속성 닫기"
            title="닫기"
          >
            <X size={18} />
          </button>
        </div>
        {!selected && (
          <p className="ed-props__hint">
            위 도구에서 글자·그림·도형을 더해 보세요. 캔버스의 요소를
            클릭하면 여기서 자세히 꾸밀 수 있어요.
          </p>
        )}

        {selected && isText && (
          <>
            <div className="ed-props__group">
              <label className="ed-props__label">내용</label>
              <textarea
                className="ed-input"
                rows={3}
                value={(selected as unknown as { text: string }).text ?? ""}
                onChange={(e) => updateSelected({ text: e.target.value })}
              />
            </div>
            <div className="ed-props__group">
              <label className="ed-props__label">글꼴</label>
              <div className="ed-props__row">
              <select
                className="ed-select"
                value={
                  (selected as unknown as { fontFamily: string }).fontFamily ??
                  DEFAULT_FONT.family
                }
                onChange={async (e) => {
                  const family = e.target.value;
                  await ensureFont(family);
                  updateSelected({ fontFamily: family });
                  // Fabric caches text measurements; force a re-layout.
                  const api = apiRef.current;
                  if (api?.canvas && selected) {
                    (selected as unknown as { initDimensions?: () => void })
                      .initDimensions?.();
                    api.canvas.requestRenderAll();
                  }
                }}
              >
                {groupFonts().map(({ group, items }) => (
                  <optgroup key={group} label={group}>
                    {items.map((f) => (
                      <option
                        key={f.family}
                        value={f.family}
                        style={{ fontFamily: `"${f.family}", sans-serif` }}
                      >
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
                <ColorField
                  className="ed-swatch ed-swatch--square"
                  value={
                    (selected as unknown as { fill: string }).fill || "#000000"
                  }
                  onChange={(c) => updateSelected({ fill: c })}
                />
              </div>
            </div>
            <div className="ed-props__group ed-props__group--half">
              <label className="ed-props__label">글자 크기</label>
              <NumberStepper
                value={
                  (selected as unknown as { fontSize?: number }).fontSize ?? 24
                }
                min={8}
                max={300}
                step={2}
                onChange={(n) => updateSelected({ fontSize: n })}
              />
            </div>
            <div className="ed-props__group ed-props__group--half">
              <label className="ed-props__label">두께</label>
              <div className="ed-btn-row">
                <button
                  type="button"
                  className={`ed-mini${
                    (selected as unknown as { fontWeight: string })
                      .fontWeight === "normal"
                      ? " is-active"
                      : ""
                  }`}
                  onClick={() => updateSelected({ fontWeight: "normal" })}
                  title="보통"
                >
                  보통
                </button>
                <button
                  type="button"
                  className={`ed-mini${
                    (selected as unknown as { fontWeight: string })
                      .fontWeight === "bold"
                      ? " is-active"
                      : ""
                  }`}
                  onClick={() => updateSelected({ fontWeight: "bold" })}
                  title="굵게"
                >
                  <Bold size={14} />
                </button>
              </div>
            </div>
            <div className="ed-props__group ed-props__group--half">
              <label className="ed-props__label">줄 간격</label>
              <NumberStepper
                value={
                  (selected as unknown as { lineHeight?: number }).lineHeight ??
                  1.16
                }
                min={0.6}
                max={3}
                step={0.1}
                decimals={1}
                onChange={(n) => updateSelected({ lineHeight: n })}
              />
            </div>
            <div className="ed-props__group ed-props__group--half">
              <label className="ed-props__label">자간</label>
              <NumberStepper
                value={
                  (selected as unknown as { charSpacing?: number })
                    .charSpacing ?? 0
                }
                min={-200}
                max={1000}
                step={25}
                onChange={(n) => updateSelected({ charSpacing: n })}
              />
            </div>
            <div className="ed-props__group">
              <label className="ed-props__label">정렬</label>
              <div className="ed-btn-row">
                {(
                  [
                    ["left", AlignLeft, "왼쪽"],
                    ["center", AlignCenter, "가운데"],
                    ["right", AlignRight, "오른쪽"],
                  ] as const
                ).map(([a, Icon, title]) => (
                  <button
                    key={a}
                    type="button"
                    className={`ed-mini${
                      (selected as unknown as { textAlign: string })
                        .textAlign === a
                        ? " is-active"
                        : ""
                    }`}
                    onClick={() => updateSelected({ textAlign: a })}
                    title={title}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>
            <div className="ed-props__group">
              <div className="ed-section-head">
                <button
                  type="button"
                  className="ed-section-toggle"
                  onClick={() => setOutlineOpen((v) => !v)}
                  aria-expanded={outlineOpen}
                >
                  <ChevronDown
                    size={16}
                    className={`ed-chevron${outlineOpen ? "" : " is-collapsed"}`}
                  />
                  <span className="ed-props__label">외곽선</span>
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={outlineOn}
                  className={`ed-switch${outlineOn ? " is-on" : ""}`}
                  onClick={() =>
                    updateSelected(
                      outlineOn
                        ? { strokeWidth: 0 }
                        : {
                            strokeWidth: 4,
                            stroke: strokeColor,
                            paintFirst: "stroke",
                          },
                    )
                  }
                >
                  <span className="ed-switch__knob" />
                </button>
              </div>
              {outlineOn && outlineOpen && (
                <>
                  <div className="ed-row-field">
                    <span className="ed-props__label">색상</span>
                    <ColorField
                      className="ed-swatch"
                      value={strokeColor}
                      onChange={(c) =>
                        updateSelected({ stroke: c, paintFirst: "stroke" })
                      }
                    />
                  </div>
                  <LabeledSlider
                    label="두께"
                    value={strokeWidth}
                    min={1}
                    max={30}
                    step={1}
                    onChange={(n) =>
                      updateSelected({
                        strokeWidth: n,
                        stroke: strokeColor,
                        paintFirst: "stroke",
                      })
                    }
                  />
                </>
              )}
            </div>
            <div className="ed-props__group">
              <div className="ed-section-head">
                <button
                  type="button"
                  className="ed-section-toggle"
                  onClick={() => setShadowOpen((v) => !v)}
                  aria-expanded={shadowOpen}
                >
                  <ChevronDown
                    size={16}
                    className={`ed-chevron${shadowOpen ? "" : " is-collapsed"}`}
                  />
                  <span className="ed-props__label">그림자</span>
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={shadow.on}
                  className={`ed-switch${shadow.on ? " is-on" : ""}`}
                  onClick={() =>
                    void applyShadowParams({ ...shadow, on: !shadow.on })
                  }
                >
                  <span className="ed-switch__knob" />
                </button>
              </div>
              {shadow.on && shadowOpen && (
                <>
                  <div className="ed-row-field">
                    <span className="ed-props__label">색상</span>
                    <ColorField
                      className="ed-swatch"
                      value={shadow.hex}
                      onChange={(c) =>
                        void applyShadowParams({ ...shadow, hex: c })
                      }
                    />
                  </div>
                  <LabeledSlider
                    label="방향"
                    suffix="°"
                    value={shadow.angle}
                    min={0}
                    max={360}
                    step={1}
                    onChange={(n) =>
                      void applyShadowParams({ ...shadow, angle: n })
                    }
                  />
                  <LabeledSlider
                    label="불투명도"
                    suffix="%"
                    value={shadow.opacity}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(n) =>
                      void applyShadowParams({ ...shadow, opacity: n })
                    }
                  />
                  <LabeledSlider
                    label="거리"
                    value={shadow.distance}
                    min={0}
                    max={60}
                    step={1}
                    onChange={(n) =>
                      void applyShadowParams({ ...shadow, distance: n })
                    }
                  />
                  <LabeledSlider
                    label="흐림"
                    value={shadow.blur}
                    min={0}
                    max={50}
                    step={1}
                    onChange={(n) =>
                      void applyShadowParams({ ...shadow, blur: n })
                    }
                  />
                </>
              )}
            </div>
          </>
        )}

        {selected && isShape && (
          <>
            <div className="ed-props__group">
              <label className="ed-props__label">색</label>
              <div className="ed-props__row">
                <ColorField
                  value={
                    (selected as unknown as { fill: string }).fill || "#ffd05f"
                  }
                  onChange={(c) => updateSelected({ fill: c })}
                  className="ed-input"
                />
                <input
                  className="ed-input"
                  value={
                    (selected as unknown as { fill: string }).fill || "#ffd05f"
                  }
                  onChange={(e) => updateSelected({ fill: e.target.value })}
                />
              </div>
            </div>
          </>
        )}

        {selected && canFit && (
          <div className="ed-props__group">
            <label className="ed-props__label">화면 채우기</label>
            <div className="ed-fit-grid">
              {FIT_PRESETS.map(({ key, label, Icon, preset }) => (
                <button
                  key={key}
                  type="button"
                  className={`ed-fit-btn ed-fit-btn--${key}`}
                  title={label}
                  onClick={() => fitToPreset(preset)}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selected && (
          <>
            <div className="ed-props__group">
              <label className="ed-props__label">레이어 순서</label>
              <div className="ed-btn-row">
                <button
                  type="button"
                  className="ed-mini"
                  onClick={() => layerAction("back")}
                >
                  맨뒤
                </button>
                <button
                  type="button"
                  className="ed-mini"
                  onClick={() => layerAction("backward")}
                >
                  뒤로
                </button>
                <button
                  type="button"
                  className="ed-mini"
                  onClick={() => layerAction("forward")}
                >
                  앞으로
                </button>
                <button
                  type="button"
                  className="ed-mini"
                  onClick={() => layerAction("front")}
                >
                  맨앞
                </button>
              </div>
            </div>
            <button
              type="button"
              className="ed-danger"
              onClick={deleteSelected}
            >
              <Trash2 size={16} /> 삭제
            </button>
          </>
        )}
      </aside>
    </div>
  );
}

/** Re-center horizontally-centered objects (originX:"center") to a new page
 * width, in serialized page data. Used when the 판형 width changes so cover
 * titles/subtitles (and other centered text) stay centered. */
function recenterCenterObjects(
  data: object | null,
  pageW: number,
): object | null {
  if (!data) return data;
  const d = data as { objects?: Array<Record<string, unknown>> };
  if (!Array.isArray(d.objects)) return data;
  const clone = JSON.parse(JSON.stringify(data)) as {
    objects: Array<Record<string, unknown>>;
  };
  for (const o of clone.objects) {
    if (o.originX === "center") o.left = pageW / 2;
  }
  return clone;
}

function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
function fmtNum(n: number, decimals: number): string {
  return decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
}

/** Label + editable number + range slider (used for outline/shadow controls). */
function LabeledSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (n: number) => void;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="ed-slider-field">
      <div className="ed-slider-field__head">
        <span className="ed-props__label">{label}</span>
        <span className="ed-slider-field__num">
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange(clamp(n));
            }}
          />
          {suffix ? <em>{suffix}</em> : null}
        </span>
      </div>
      <input
        type="range"
        className="ed-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/**
 * Generic − [input] + stepper. Uses a local text buffer so the field can be
 * cleared and retyped freely (a plain controlled number input snapped empty
 * values back to 0, which made editing impossible). The value only updates
 * while typing if it parses in range; blur clamps + normalizes. Supports
 * decimals (e.g. line height) and negatives (e.g. letter spacing).
 */
function NumberStepper({
  value,
  onChange,
  min,
  max,
  step,
  decimals = 0,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  decimals?: number;
}) {
  const [text, setText] = useState(fmtNum(value, decimals));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(fmtNum(value, decimals));
  }, [value, editing, decimals]);

  const clamp = (n: number) =>
    roundTo(Math.min(max, Math.max(min, n)), decimals);
  const commit = (n: number) => {
    const c = clamp(Number.isFinite(n) ? n : value);
    onChange(c);
    setText(fmtNum(c, decimals));
  };

  const allowNeg = min < 0;
  const filter = new RegExp(
    `[^0-9${decimals > 0 ? "." : ""}${allowNeg ? "\\-" : ""}]`,
    "g",
  );

  return (
    <div className="ed-stepper">
      <button
        type="button"
        className="ed-stepper__btn"
        onClick={() => commit(value - step)}
        aria-label="줄이기"
      >
        −
      </button>
      <input
        className="ed-stepper__input"
        inputMode={decimals > 0 ? "decimal" : "numeric"}
        value={text}
        onFocus={() => setEditing(true)}
        onChange={(e) => {
          const v = e.target.value.replace(filter, "");
          setText(v);
          const n = parseFloat(v);
          if (!Number.isNaN(n) && n >= min && n <= max) {
            onChange(roundTo(n, decimals));
          }
        }}
        onBlur={() => {
          setEditing(false);
          const n = parseFloat(text);
          commit(Number.isNaN(n) ? value : n);
        }}
      />
      <button
        type="button"
        className="ed-stepper__btn"
        onClick={() => commit(value + step)}
        aria-label="늘리기"
      >
        +
      </button>
    </div>
  );
}
