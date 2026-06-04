"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  BookMarked,
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
  Redo2,
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
import ThumbnailModal from "../ThumbnailModal";
import CoverPromptModal from "./CoverPromptModal";
import NarrationEditorModal from "./NarrationEditorModal";
import BookMusicModal from "./BookMusicModal";
import ContentTextModal, {
  type SpreadRow,
  splitBlocks,
  orderedCells,
} from "./ContentTextModal";
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

// The first image object (the spread background) in a serialized page.
function firstSpreadImage(
  data: object | null,
): Record<string, unknown> | null {
  if (!data) return null;
  const objs = (data as { objects?: Array<Record<string, unknown>> }).objects;
  if (!Array.isArray(objs)) return null;
  return (
    objs.find((o) => o.type === "image" || o.type === "Image") ?? null
  );
}

/**
 * Keep the two halves of a continuous spread aligned: when the image on one
 * half is moved/scaled, the partner half follows so the seam at the page edge
 * stays matched. The right half's image left = the left half's left − pageW
 * (and vice-versa); top/scale/angle are mirrored exactly. Returns the same
 * array reference when there's no linked partner or nothing actually changed,
 * so callers don't trigger needless re-renders.
 */
function syncSpreadPartnerPages(
  pages: EditorPage[],
  idx: number,
  pageW: number,
): EditorPage[] {
  const src = pages[idx];
  if (!src?.spreadId || !src.spreadSide) return pages;
  const partnerIdx = pages.findIndex(
    (p, i) => i !== idx && p.spreadId === src.spreadId,
  );
  if (partnerIdx < 0) return pages;
  const partner = pages[partnerIdx];
  const srcImg = firstSpreadImage(src.data);
  const curImg = firstSpreadImage(partner.data);
  if (!srcImg || !curImg || !partner.data) return pages;

  const shift = src.spreadSide === "left" ? -pageW : pageW;
  const targetLeft = ((srcImg.left as number) ?? 0) + shift;
  const targetTop = (srcImg.top as number) ?? 0;
  const targetSX = srcImg.scaleX;
  const targetSY = srcImg.scaleY;
  const targetAngle = (srcImg.angle as number) ?? 0;

  // Skip work (and the partner re-render) when the image edit didn't actually
  // move the partner — e.g. editing text on this half.
  if (
    curImg.left === targetLeft &&
    curImg.top === targetTop &&
    curImg.scaleX === targetSX &&
    curImg.scaleY === targetSY &&
    ((curImg.angle as number) ?? 0) === targetAngle
  ) {
    return pages;
  }

  const partnerData = JSON.parse(JSON.stringify(partner.data)) as object;
  const dstImg = firstSpreadImage(partnerData);
  if (!dstImg) return pages;
  dstImg.left = targetLeft;
  dstImg.top = targetTop;
  if (targetSX !== undefined) dstImg.scaleX = targetSX;
  if (targetSY !== undefined) dstImg.scaleY = targetSY;
  dstImg.angle = targetAngle;

  return pages.map((p, i) =>
    i === partnerIdx ? { ...p, data: partnerData } : p,
  );
}

/**
 * Backfill spread links onto existing pages. Books built before spread linking
 * hold a wide image split across two pages with no spreadId, so the two halves
 * drift apart when nudged independently (a few px gap at the fold). Detect
 * adjacent content pairs that are clearly two halves of one image — same image
 * source, same scale, right half within a page-width of continuity — then link
 * them (shared spreadId) and snap the right half to `leftLeft − pageW` so the
 * seam meets exactly. Anchors on the left page. Idempotent: returns the same
 * array reference when every pair is already linked and aligned. Pairs that are
 * just duplicates (right.left == left.left) are left alone — not a split.
 */
function linkAndHealSpreadPairs(
  pages: EditorPage[],
  pageW: number,
): EditorPage[] {
  let changed = false;
  const next = pages.slice();
  for (let i = 1; i + 1 < pages.length; i += 2) {
    const left = pages[i];
    const right = pages[i + 1];
    if (left?.kind !== "content" || right?.kind !== "content") continue;
    const lImg = firstSpreadImage(left.data);
    const rImg = firstSpreadImage(right.data);
    if (!lImg || !rImg) continue;
    if (!lImg.src || lImg.src !== rImg.src) continue; // not the same image
    const lsx = lImg.scaleX as number | undefined;
    const rsx = rImg.scaleX as number | undefined;
    if (lsx === undefined || rsx === undefined) continue;
    if (Math.abs(lsx - rsx) > Math.abs(lsx) * 0.01) continue; // scales differ
    const lLeft = (lImg.left as number) ?? 0;
    const ideal = lLeft - pageW;
    // Within one page-width of perfect continuity → a split spread; a plain
    // duplicate sits exactly `pageW` away, so it's excluded.
    if (Math.abs(((rImg.left as number) ?? 0) - ideal) >= pageW) continue;

    const sid =
      left.spreadId ??
      right.spreadId ??
      Math.random().toString(36).slice(2, 10);
    const lTop = (lImg.top as number) ?? 0;
    const lAngle = (lImg.angle as number) ?? 0;
    const needLink =
      left.spreadId !== sid ||
      left.spreadSide !== "left" ||
      right.spreadId !== sid ||
      right.spreadSide !== "right";
    const needHeal =
      rImg.left !== ideal ||
      rImg.top !== lTop ||
      rImg.scaleX !== lsx ||
      rImg.scaleY !== (lImg.scaleY as number) ||
      ((rImg.angle as number) ?? 0) !== lAngle;
    if (!needLink && !needHeal) continue;

    changed = true;
    next[i] = { ...left, spreadId: sid, spreadSide: "left" };
    if (needHeal) {
      const rData = JSON.parse(JSON.stringify(right.data)) as object;
      const d = firstSpreadImage(rData);
      if (d) {
        d.left = ideal;
        d.top = lTop;
        d.scaleX = lsx;
        d.scaleY = lImg.scaleY as number;
        d.angle = lAngle;
      }
      next[i + 1] = {
        ...right,
        spreadId: sid,
        spreadSide: "right",
        data: rData,
      };
    } else {
      next[i + 1] = { ...right, spreadId: sid, spreadSide: "right" };
    }
  }
  return changed ? next : pages;
}

type Props = {
  onFinish: (
    pages: EditorPage[],
    pageW: number,
    layout: BookLayout,
    storyText: string,
  ) => Promise<void> | void;
  // 임시저장: persist the current pages as a private draft (cloud). May throw
  // on failure (the editor shows the message). Optional so the editor still
  // works without a draft host.
  onSaveDraft?: (
    pages: EditorPage[],
    pageW: number,
    layout: BookLayout,
    storyText: string,
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
  // Book id (when editing a saved book) — required to upload page narration.
  bookId?: string;
  // Existing per-page narration keys (null where none), for showing state.
  initialNarration?: (string | null)[];
  // The book's current background-music R2 key (audioKey), if any.
  initialAudioKey?: string;
  // The book's saved 내용추가 script, to refill the textarea on re-edit.
  initialStoryText?: string;
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
  bookId,
  initialNarration,
  initialAudioKey,
  initialStoryText,
}: Props) {
  // Shadow PAGE_W with the per-book width so all the body coordinate math uses
  // the chosen 판형. Height stays PAGE_H. The parent remounts on 판형 change.
  const PAGE_W = pageW;
  // Restore the previous session if present. The draft lives in IndexedDB
  // (async), so we start from defaults and hydrate in an effect below; the
  // autosave effect is gated on `hydratedRef` so it can't overwrite the stored
  // draft with these defaults before the load lands.
  const [pages, setPages] = useState<EditorPage[]>(() => {
    if (initialPages && initialPages.length > 0)
      return linkAndHealSpreadPairs(initialPages, pageW);
    return [{ ...makePage("cover") }, { ...makePage("content") }];
  });
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const hydratedRef = useRef(false);
  const [selected, setSelected] = useState<FabricObject | null>(null);
  // Mobile: the page list is a left slide-out drawer and the properties panel
  // is a right slide-out drawer, each toggled by a topbar button. On desktop
  // both are always-visible in the grid and these are ignored.
  const [pagelistOpen, setPagelistOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  // Collapsible 외곽선/그림자 sections (collapsed by default).
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [shadowOpen, setShadowOpen] = useState(false);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [_changeTick, setChangeTick] = useState(0);
  const [guides, setGuides] = useState<Guide[]>([]);
  // Default to spread (펼침) view — books are spread by default, and the
  // 전체추가 auto-build produces left/right spread pairs that read correctly
  // only side by side.
  const [spreadMode, setSpreadMode] = useState(true);
  const [partnerPng, setPartnerPng] = useState<string | null>(null);
  // 내용 추가 모달: the whole story (blank-line-separated blocks) + the set of
  // selected page ids the blocks map onto, in page order.
  const [contentModalOpen, setContentModalOpen] = useState(false);
  // Seeded from the saved book (initialStoryText); for a local working draft it
  // is restored from IndexedDB in the hydrate effect below.
  const [captionText, setCaptionText] = useState(initialStoryText ?? "");
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [applyingCaptions, setApplyingCaptions] = useState(false);
  // "전체" toggle: when on, changing any text property (글꼴/글씨색/크기/두께/
  // 줄간격/자간/정렬/외곽선/그림자) applies to every text object across all
  // pages, not just the selected one.
  const [applyFontAll, setApplyFontAll] = useState(false);

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
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  // React's typed JSX won't reliably emit the non-standard folder-picker
  // attributes, so set them imperatively once the input mounts.
  useEffect(() => {
    const el = folderInputRef.current;
    if (!el) return;
    el.setAttribute("webkitdirectory", "");
    el.setAttribute("directory", "");
    el.setAttribute("mozdirectory", "");
  }, []);
  // Refs so the debounced snapshot callback can read the latest active page
  // index without re-binding (which would clear the pending timer).
  const activeIndexRef = useRef(activeIndex);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);
  // Latest pages, so handleReady (a stable [] callback) doesn't decide whether
  // to seed a blank cover from a STALE first-render snapshot — which, on a 판형
  // change remount, wrongly re-seeded the default cover over a saved one.
  const pagesRef = useRef(pages);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  // Per-page narration (R2 keys, null = none). Uploaded straight to R2 via the
  // book's id — so the book must be saved (임시저장) first to have an id.
  // Per-page narration keys are tracked so the 나레이션 편집 modal can report
  // applied pages; narration is added there (no separate per-page 음성 button).
  const [, setNarration] = useState<(string | null)[]>(
    () => initialNarration ?? [],
  );
  const [narrEditorOpen, setNarrEditorOpen] = useState(false);

  // Background music (BGM) for the whole book — same audioKey storage the
  // library uses. The book must be saved (임시저장) first to have an id.
  // Picking is done in BookMusicModal (own upload or shared-pool select).
  const [bgmKey, setBgmKey] = useState<string | null>(initialAudioKey ?? null);
  const [bgmModalOpen, setBgmModalOpen] = useState(false);
  const hasBgm = !!bgmKey;

  // 썸네일 만들기: a mini-editor modal that seeds from the cover (page 0) and
  // exports a downloadable thumbnail at 16:9 / 9:16 / 1:1 / 판형.
  const [thumbOpen, setThumbOpen] = useState(false);
  // 표지: copy a front/back cover image-generation prompt built from the script.
  const [coverPromptOpen, setCoverPromptOpen] = useState(false);

  // Mark the given page indices as having narration (after the editor applies
  // segments). Keeps the 음성 tool's green dot in sync.
  const markNarrationPages = useCallback((indices: number[]) => {
    setNarration((prev) => {
      const next = [...prev];
      for (const i of indices) {
        while (next.length <= i) next.push(null);
        next[i] = `narration/${bookId}/${i}.mp3`;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

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
  // When true, the canvas is being driven as a scratch surface to build many
  // pages at once (전체추가). Snapshotting must be fully suppressed: otherwise
  // the debounced timer would serialize scratch content into whichever page is
  // active and clobber it.
  const bulkBuildingRef = useRef(false);
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

  // Record a page-content change in that page's undo history. Bulk operations
  // (전체글꼴 / 내용추가) bypass the canvas-event snapshot, so they call this so
  // the change is still undoable. Seeds the pre-change state as a baseline when
  // the page has no history yet, then appends the post-change state.
  const recordPageEdit = useCallback(
    (pageId: string, before: object | null, after: object) => {
      const h = getHistory(pageId);
      if (h.past.length === 0 && before) h.past.push(before);
      h.past.push(after);
      while (h.past.length > HISTORY_LIMIT) h.past.shift();
      h.future = [];
    },
    [getHistory],
  );

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

  // Hydrate the previous session from IndexedDB once on mount (only for a fresh
  // editor — when initialPages is passed we're editing an existing book and the
  // working draft must not stomp it).
  useEffect(() => {
    if (initialPages && initialPages.length > 0) {
      hydratedRef.current = true;
      return;
    }
    let cancelled = false;
    void loadEditorState().then((saved) => {
      if (cancelled) return;
      if (saved && saved.pages.length > 0) {
        // Link + align any pre-existing spread pairs (older drafts have no
        // spreadId, so their two halves can sit a few px off at the fold).
        const healed = linkAndHealSpreadPairs(saved.pages, saved.pageW ?? pageW);
        const idx = Math.min(saved.activeIndex, healed.length - 1);
        setPages(healed);
        setActiveIndex(idx);
        if (typeof saved.storyText === "string") setCaptionText(saved.storyText);
        // If the canvas is already up (handleReady ran first, before this async
        // draft load, and may have seeded a blank default cover), reload it with
        // the restored active page so the saved content isn't left hidden. Only
        // when that page actually has data — never blank out a seeded cover.
        const api = apiRef.current;
        if (api && healed[idx]?.data) void api.load(healed[idx].data as object);
      }
      hydratedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save pages + activeIndex to IndexedDB so closing the tab or jumping to
  // the book viewer and back doesn't lose work. Debounced so dragging a single
  // object doesn't write to storage 60 times a second. Skipped until the draft
  // has hydrated so the initial defaults don't overwrite a saved session.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const id = window.setTimeout(() => {
      void saveEditorState({
        pages,
        activeIndex,
        savedAt: Date.now(),
        pageW,
        layout,
        storyText: captionText,
      });
    }, 500);
    return () => window.clearTimeout(id);
  }, [pages, activeIndex, pageW, layout, captionText]);

  // Snapshot the live Fabric canvas into pages[activeIndex] (debounced) so
  // edits within a single page are persisted too — not only structural
  // changes like add/remove. Without this, only "switch page" actions would
  // commit the canvas into the pages state.
  // Also push the snapshot to the active page's undo history (unless we're
  // currently applying an undo/redo, which would otherwise re-record itself).
  const handleCanvasChange = useCallback(() => {
    // While bulk-building pages the canvas is just scratch — ignore every
    // object:added/modified/removed it fires.
    if (bulkBuildingRef.current) return;
    // Programmatic loads (undo/redo, page switch, initial restore) fire Fabric
    // object:added events too. Skip scheduling a snapshot for those, otherwise
    // every load re-records the loaded state and floods history with identical
    // entries — which made undo a no-op (it "restored" the same state).
    if (isApplyingHistoryRef.current) return;
    setChangeTick((x) => x + 1);
    if (snapshotTimerRef.current !== null) {
      window.clearTimeout(snapshotTimerRef.current);
    }
    snapshotTimerRef.current = window.setTimeout(() => {
      // The timer fired — mark it not-pending so a later flushSnapshot (on
      // undo/redo) doesn't think there's still a snapshot to take and record a
      // duplicate (which made undo need two presses for one change).
      snapshotTimerRef.current = null;
      const api = apiRef.current;
      if (!api) return;
      const idx = activeIndexRef.current;
      const data = api.serialize();
      const thumb = api.toPng(0.2);
      setPages((prev) => {
        const pageId = prev[idx]?.id;
        if (pageId && !isApplyingHistoryRef.current) {
          const h = getHistory(pageId);
          // Seed the pre-edit state as a baseline the first time this page is
          // touched — otherwise the first edit leaves past=[afterState] and
          // undo (which needs ≥2 entries) silently no-ops.
          if (h.past.length === 0 && prev[idx]?.data) {
            h.past.push(prev[idx].data as object);
          }
          // Skip dedup: each snapshot represents a meaningful edit (Fabric
          // only fires modified/added/removed on actual user actions). Doing
          // JSON.stringify here was blocking the main thread for tens of ms
          // on pages with images, contributing to perceived freezing.
          h.past.push(data);
          if (h.past.length > HISTORY_LIMIT) h.past.shift();
          h.future = []; // any new edit clears the redo branch
          setHistoryTick((t) => t + 1);
        }
        const saved = prev.map((p, i) =>
          i === idx ? { ...p, data, thumb } : p,
        );
        // Linked spread half? Pull its partner along to keep the seam aligned.
        return syncSpreadPartnerPages(saved, idx, PAGE_W);
      });
    }, 700);
  }, [getHistory, PAGE_W]);

  // Commit any pending (debounced) snapshot right now, so undo/redo pressed
  // within 700ms of an edit still see that edit in history.
  const flushSnapshot = useCallback(() => {
    if (snapshotTimerRef.current === null) return;
    window.clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = null;
    const api = apiRef.current;
    if (!api || isApplyingHistoryRef.current) return;
    const idx = activeIndexRef.current;
    const data = api.serialize();
    const thumb = api.toPng(0.2);
    const cur = pagesRef.current;
    const pageId = cur[idx]?.id;
    if (pageId) {
      const h = getHistory(pageId);
      if (h.past.length === 0 && cur[idx]?.data) {
        h.past.push(cur[idx].data as object);
      }
      h.past.push(data);
      if (h.past.length > HISTORY_LIMIT) h.past.shift();
      h.future = [];
      setHistoryTick((t) => t + 1);
    }
    setPages((prev) =>
      syncSpreadPartnerPages(
        prev.map((p, i) => (i === idx ? { ...p, data, thumb } : p)),
        idx,
        PAGE_W,
      ),
    );
  }, [getHistory, PAGE_W]);

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
    flushSnapshot(); // capture a just-made edit that hasn't debounced yet
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
    setPages((p) => {
      const restored = p.map((pg, i) =>
        i === activeIndex
          ? { ...pg, data: prev, thumb: api.toPng(0.2) }
          : pg,
      );
      // Keep a linked spread half's partner in step with the undone page.
      return syncSpreadPartnerPages(restored, activeIndex, PAGE_W);
    });
    setSelected(null);
    setHistoryTick((t) => t + 1);
    isApplyingHistoryRef.current = false;
  }, [pages, activeIndex, getHistory, flushSnapshot, PAGE_W]);

  const redo = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    flushSnapshot(); // commit any just-made edit first
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
    setPages((p) => {
      const restored = p.map((pg, i) =>
        i === activeIndex
          ? { ...pg, data: next, thumb: api.toPng(0.2) }
          : pg,
      );
      return syncSpreadPartnerPages(restored, activeIndex, PAGE_W);
    });
    setSelected(null);
    setHistoryTick((t) => t + 1);
    isApplyingHistoryRef.current = false;
  }, [pages, activeIndex, getHistory, flushSnapshot, PAGE_W]);

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
      // Delete / Backspace → remove the selected object(s). Skipped above while
      // typing in an input/textarea or editing a text object on the canvas.
      if (e.key === "Delete" || e.key === "Backspace") {
        const c = apiRef.current?.canvas;
        const objs = c?.getActiveObjects?.() ?? [];
        if (c && objs.length) {
          e.preventDefault();
          objs.forEach((o) => c.remove(o));
          c.discardActiveObject();
          c.requestRenderAll();
          setSelected(null);
        }
        return;
      }
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
    void clearEditorState().finally(() => window.location.reload());
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
    // Suppress snapshotting while we programmatically load/seed the page —
    // the load's object:added events would otherwise record a fake "edit".
    isApplyingHistoryRef.current = true;
    try {
    // Preload fonts so the Fabric canvas renders the right glyphs.
    await preloadAllFonts();
    // Read the CURRENT pages (not the stale first-render closure) so a 판형
    // change remount doesn't treat an already-saved cover as blank and re-seed.
    const curPages = pagesRef.current;
    const curIdx = activeIndexRef.current;
    const activePage = curPages[curIdx];
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
          lineHeight: 1.5,
        });
        const sub = new fabric.IText("부제 또는 지은이", {
          left: PAGE_W / 2,
          top: PAGE_H * 0.3,
          originX: "center",
          fontSize: 36,
          fontFamily: DEFAULT_FONT.family,
          fill: "#6a4a2b",
          textAlign: "center",
          lineHeight: 1.5,
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
        // Only trust the live canvas for the active page if real content was
        // loaded into it. If it was a freshly-seeded blank cover, recenter the
        // stored data instead so we never overwrite a saved page with the seed.
        const activeHadData = !!activePage?.data;
        setPages((prev) =>
          prev.map((pg, i) =>
            i === idx && activeHadData
              ? { ...pg, data, thumb }
              : { ...pg, data: recenterCenterObjects(pg.data, w) },
          ),
        );
      }
    }
    } finally {
      isApplyingHistoryRef.current = false;
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
      const saved = pages.map((p, i) =>
        i === activeIndex ? { ...p, data, thumb } : p,
      );
      // Sync the spread partner before loading, so switching to the other half
      // right after adjusting this one shows the freshly-aligned position.
      const synced = syncSpreadPartnerPages(saved, activeIndex, PAGE_W);
      setPages(synced);
      // Suppress snapshotting for this programmatic load (its object:added
      // events would otherwise record the loaded page as a fake "edit").
      isApplyingHistoryRef.current = true;
      try {
        await api.load(synced[newIndex]?.data ?? null);
      } finally {
        isApplyingHistoryRef.current = false;
      }
      const c = api.canvas;
      if (c) {
        setBgColor((c.backgroundColor as string) || "#ffffff");
      }
      setSelected(null);
      setActiveIndex(newIndex);
    },
    [activeIndex, pages, PAGE_W],
  );

  // Tools: add text / image / rect / circle.

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

  // Content pages (cover excluded) grouped into spreads: (1,2), (3,4), … shown
  // side by side, but each page is its own selectable cell. Left page (odd
  // index) → top-left caption; right page (even index ≥2) → top-right.
  const captionSpreads = useMemo<SpreadRow[]>(() => {
    const cell = (idx: number) => {
      const p = pages[idx];
      if (!p || p.kind === "cover") return null;
      return {
        id: p.id,
        index: idx,
        label: `${idx}쪽`,
        thumb: p.thumb,
        isRight: layout === "spread" && idx >= 2 && idx % 2 === 0,
      };
    };
    const rows: SpreadRow[] = [];
    for (let i = 1; i < pages.length; i += 2) {
      const left = cell(i);
      if (!left) continue;
      rows.push({ key: left.id, left, right: cell(i + 1) });
    }
    return rows;
  }, [pages, layout]);

  // 내용 추가: open the modal. Snapshot the live active page first so the
  // thumbnails are up to date. Keep captionText as-is so a previously entered
  // (and saved) script is shown again for further editing; only the page
  // selection resets each open.
  const openContentModal = useCallback(() => {
    const api = apiRef.current;
    if (api) {
      const data = api.serialize();
      const thumb = api.toPng(0.2);
      const idx = activeIndexRef.current;
      setPages((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, data, thumb } : p)),
      );
    }
    setSelectedPages([]);
    setContentModalOpen(true);
  }, []);

  // 적용: split the story into blocks on blank lines and drop each block onto
  // the matching selected page (page order), at its default text position —
  // left page → top-left, right page → top-right (the 글자 default). A Textbox
  // wraps long content within the page width; fine positioning is manual.
  const applyCaptions = useCallback(async () => {
    const api = apiRef.current;
    if (!api?.canvas) return;

    const blocks = splitBlocks(captionText);
    const sel = new Set(selectedPages);
    // Selected page cells in page order, zipped with blocks one-to-one.
    const chosen = orderedCells(captionSpreads).filter((c) => sel.has(c.id));
    const assignments = chosen
      .map((c, k) => ({ index: c.index, isRight: c.isRight, text: blocks[k] }))
      .filter((a) => a.text);
    if (assignments.length === 0) {
      setContentModalOpen(false);
      return;
    }

    setApplyingCaptions(true);
    const fabric = await import("fabric");
    await ensureFont(
      DEFAULT_FONT.family,
      400,
      assignments.map((a) => a.text).join(""),
    );

    // Capture the live active page (unsaved edits) as its baseline.
    const curIdx = activeIndexRef.current;
    const curData = api.serialize();
    const curThumb = api.toPng(0.2);
    const baseline = pages.map((p, i) =>
      i === curIdx ? { ...p, data: curData, thumb: curThumb } : p,
    );

    bulkBuildingRef.current = true;
    if (snapshotTimerRef.current !== null) {
      window.clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
    }
    try {
      const result = [...baseline];
      for (const { index, isRight, text } of assignments) {
        const page = result[index];
        if (!page) continue;
        await api.load(page.data);
        // Replace, don't stack: drop any auto-caption this page already has so
        // re-applying (e.g. after reloading a saved script) doesn't pile text
        // on top of text. Hand-typed text (no caption flag) is left alone.
        for (const o of api.canvas
          .getObjects()
          .filter((o) => (o as { caption?: boolean }).caption)) {
          api.canvas.remove(o);
        }
        const t = new fabric.Textbox(text, {
          top: 80,
          width: PAGE_W - 160,
          fontSize: 48,
          fontFamily: DEFAULT_FONT.family,
          fill: "#2c1d10",
          editable: true,
          lineHeight: 1.5,
          textAlign: isRight ? "right" : "left",
          ...(isRight
            ? { originX: "right" as const, left: PAGE_W - 80 }
            : { left: 80 }),
        });
        // Tag as an auto-added caption so we can find/replace/clear it later.
        (t as { caption?: boolean }).caption = true;
        api.canvas.add(t);
        api.canvas.requestRenderAll();
        const after = api.serialize();
        recordPageEdit(page.id, page.data, after);
        result[index] = { ...page, data: after, thumb: api.toPng(0.2) };
      }
      setPages(result);
      setHistoryTick((t) => t + 1);
      // Restore the page we were on (now carrying its caption, if any).
      await api.load(result[curIdx]?.data ?? curData);
      setSelected(null);
    } finally {
      bulkBuildingRef.current = false;
      setApplyingCaptions(false);
      setContentModalOpen(false);
    }
  }, [
    pages,
    captionText,
    captionSpreads,
    selectedPages,
    PAGE_W,
    recordPageEdit,
  ]);

  // 기존 대사 지우기: remove every auto-added caption (the caption-flagged text)
  // from all pages, leaving hand-typed text untouched. Lets the user wipe a
  // previously applied script before re-applying a new one.
  const clearAllCaptions = useCallback(async () => {
    const api = apiRef.current;
    if (!api?.canvas) return;
    if (
      !window.confirm(
        "자동으로 넣은 대사를 모든 페이지에서 지울까요?\n(직접 입력한 글자는 그대로 남아요.)",
      )
    ) {
      return;
    }
    setApplyingCaptions(true);
    // Snapshot the live active page first so its unsaved edits aren't lost.
    const curIdx = activeIndexRef.current;
    const curData = api.serialize();
    const curThumb = api.toPng(0.2);
    const baseline = pages.map((p, i) =>
      i === curIdx ? { ...p, data: curData, thumb: curThumb } : p,
    );
    bulkBuildingRef.current = true;
    if (snapshotTimerRef.current !== null) {
      window.clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
    }
    try {
      const result = [...baseline];
      let removed = 0;
      for (let i = 0; i < result.length; i++) {
        const page = result[i];
        await api.load(page.data);
        const caps = api.canvas
          .getObjects()
          .filter((o) => (o as { caption?: boolean }).caption);
        if (caps.length === 0) continue;
        for (const o of caps) api.canvas.remove(o);
        removed += caps.length;
        api.canvas.requestRenderAll();
        const after = api.serialize();
        recordPageEdit(page.id, page.data, after);
        result[i] = { ...page, data: after, thumb: api.toPng(0.2) };
      }
      setPages(result);
      setHistoryTick((t) => t + 1);
      await api.load(result[curIdx]?.data ?? curData);
      setSelected(null);
      if (removed === 0) alert("지울 자동 대사가 없어요.");
    } finally {
      bulkBuildingRef.current = false;
      setApplyingCaptions(false);
      setContentModalOpen(false);
    }
  }, [pages, recordPageEdit]);

  // Apply a mutation to EVERY text object across all pages (the "전체" toggle).
  // Pages without text are skipped. The active page is reloaded and its
  // selection restored so editing continues uninterrupted. `apply` mutates one
  // text object; `ensureFontFamily` (optional) preloads a webfont first so the
  // off-screen reflow measures the right glyphs.
  const applyToAllText = useCallback(
    async (
      apply: (t: FabricObject) => void,
      opts?: { ensureFontFamily?: string },
    ) => {
      const api = apiRef.current;
      if (!api?.canvas) return;
      if (opts?.ensureFontFamily) await ensureFont(opts.ensureFontFamily);

      const isTextObj = (o: { type?: string }) =>
        o.type === "i-text" || o.type === "text" || o.type === "textbox";

      // Remember the selected object's slot so we can reselect it after reload.
      const curIdx = activeIndexRef.current;
      const selIndex = selected
        ? api.canvas.getObjects().indexOf(selected)
        : -1;
      const curData = api.serialize();
      const curThumb = api.toPng(0.2);
      const baseline = pages.map((p, i) =>
        i === curIdx ? { ...p, data: curData, thumb: curThumb } : p,
      );

      bulkBuildingRef.current = true;
      if (snapshotTimerRef.current !== null) {
        window.clearTimeout(snapshotTimerRef.current);
        snapshotTimerRef.current = null;
      }
      try {
        const result = [...baseline];
        for (let i = 0; i < result.length; i++) {
          const page = result[i];
          if (!page.data) continue;
          await api.load(page.data);
          const c = api.canvas;
          if (!c) continue;
          const texts = c.getObjects().filter(isTextObj);
          if (texts.length === 0) continue;
          for (const t of texts) {
            apply(t as FabricObject);
            (t as unknown as { initDimensions?: () => void }).initDimensions?.();
          }
          c.requestRenderAll();
          const after = api.serialize();
          recordPageEdit(page.id, page.data, after);
          result[i] = { ...page, data: after, thumb: api.toPng(0.2) };
        }
        setPages(result);
        setHistoryTick((t) => t + 1);
        // Reload the active page and restore the selection.
        await api.load(result[curIdx]?.data ?? curData);
        const objs = api.canvas?.getObjects() ?? [];
        const reSel = selIndex >= 0 ? objs[selIndex] : null;
        if (api.canvas && reSel) {
          api.canvas.setActiveObject(reSel);
          api.canvas.requestRenderAll();
          setSelected(reSel);
        } else {
          setSelected(null);
        }
      } finally {
        bulkBuildingRef.current = false;
      }
    },
    [pages, selected, recordPageEdit],
  );

  // 글꼴 "전체": apply a font family to every text object across all pages.
  const applyFontToAll = useCallback(
    (family: string) =>
      applyToAllText((t) => t.set({ fontFamily: family }), {
        ensureFontFamily: family,
      }),
    [applyToAllText],
  );

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
    // Default: 전체(fill page height) + 왼쪽 정렬 (left edge at 0) — ready for
    // a continuous spread (duplicate → right half).
    const ih = img.height ?? PAGE_H;
    const scale = PAGE_H / ih;
    img.set({
      scaleX: scale,
      scaleY: scale,
      angle: 0,
      left: 0,
      top: 0,
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

  /**
   * 전체추가: pick a folder, then auto-build content pages from every image in
   * it — replaying the manual "그림 → 전체 → 왼쪽정렬 → 복제" flow for each one.
   * The folder is content-only (the book's cover page is separate), so EVERY
   * image is used, starting at page 1. Each one becomes two pages:
   *   • LEFT  — image filling the page height, pinned to the left edge (전체 왼쪽정렬)
   *   • RIGHT — a duplicate; a wide image (scaledW > PAGE_W) reveals its right
   *             half so the pair reads as one continuous spread.
   * New pages are appended after the existing ones.
   */
  const addAllFromFolder = useCallback(
    async (fileList: File[]) => {
      const api = apiRef.current;
      if (!api?.canvas) return;
      const fabric = await import("fabric");

      // Image files only, natural-sorted by name; drop the first (the cover).
      // Folder-picked files often have an empty `type`, so fall back to the
      // file extension.
      const isImage = (f: File) =>
        f.type.startsWith("image/") ||
        /\.(png|jpe?g|gif|webp|bmp|avif|svg|heic|heif|tiff?|jfif)$/i.test(
          f.name,
        );
      const images = Array.from(fileList)
        .filter(isImage)
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true }),
        );
      if (images.length === 0) {
        window.alert("선택한 폴더에서 이미지를 찾지 못했어요.");
        return;
      }
      // The folder holds content only — its first image is page 1, NOT the
      // cover (the book's cover page is separate). So use every image.
      const content = images;

      // Generate starting at the SELECTED page: a selected content page becomes
      // the first generated page (replaced); if the cover is selected, start on
      // the page right after it. Pages past the start point are kept.
      const curIdx = activeIndexRef.current;
      const replaceActive = pages[curIdx]?.kind !== "cover";
      const insertAt = replaceActive ? curIdx : curIdx + 1;
      // Snapshot the current canvas so we can restore it if nothing is built.
      const curData = api.serialize();
      bulkBuildingRef.current = true;
      if (snapshotTimerRef.current !== null) {
        window.clearTimeout(snapshotTimerRef.current);
        snapshotTimerRef.current = null;
      }

      const MAX_DIM = Math.max(PAGE_W, PAGE_H) * 2;
      const built: EditorPage[] = [];
      let failed = 0;
      try {
        for (const file of content) {
          try {
            const rawUrl = await new Promise<string>((resolve, reject) => {
              const fr = new FileReader();
              fr.onload = () => resolve(fr.result as string);
              fr.onerror = () => reject(fr.error);
              fr.readAsDataURL(file);
            });
            const url = await downscaleImageDataUrl(rawUrl, MAX_DIM);
            const img = await fabric.FabricImage.fromURL(url, {
              crossOrigin: "anonymous",
            });

            // One image spans the whole spread: fill the page height, then lay
            // it across the two facing pages. A wide image starts at the
            // spread's left edge (left half here, right half on the next page);
            // a narrow image is centered over the fold so the single picture
            // sits continuously across both pages. Both halves share a spreadId
            // and the invariant `rightLeft = leftLeft − PAGE_W`, so the page
            // frames reveal continuous slices that meet exactly at the seam —
            // and moving/scaling one half keeps the other aligned.
            const ih = img.height ?? PAGE_H;
            const iw = img.width ?? PAGE_W;
            const scale = PAGE_H / ih;
            const scaledW = iw * scale;
            const isWide = scaledW > PAGE_W + 1;
            const leftPageLeft = isWide ? 0 : (PAGE_W * 2 - scaledW) / 2;
            img.set({
              scaleX: scale,
              scaleY: scale,
              angle: 0,
              left: leftPageLeft,
              top: 0,
            });

            await api.load(null);
            api.canvas.add(img);
            api.canvas.requestRenderAll();
            const leftData = api.serialize();
            const spreadId = Math.random().toString(36).slice(2, 10);
            built.push({
              id: Math.random().toString(36).slice(2, 10),
              kind: "content",
              data: leftData,
              thumb: api.toPng(0.2),
              spreadId,
              spreadSide: "left" as const,
            });

            // Right half: same image shifted one page-width left, so this page
            // frame reveals the continuation just past the fold.
            const rightData = JSON.parse(JSON.stringify(leftData)) as {
              objects?: Array<Record<string, unknown>>;
            };
            if (rightData.objects) {
              for (const obj of rightData.objects) {
                const type = obj.type as string | undefined;
                if (type === "image" || type === "Image") {
                  obj.left = leftPageLeft - PAGE_W;
                }
              }
            }
            await api.load(rightData);
            built.push({
              id: Math.random().toString(36).slice(2, 10),
              kind: "content",
              data: rightData,
              thumb: api.toPng(0.2),
              spreadId,
              spreadSide: "right" as const,
            });
          } catch (err) {
            failed += 1;
            console.error("전체추가: 이미지 처리 실패", file.name, err);
          }
        }

        if (built.length === 0) {
          // Nothing built — restore the canvas we scribbled on as scratch.
          await api.load(curData);
          window.alert(
            "이미지를 불러오지 못했어요. 콘솔 로그를 확인해 주세요.",
          );
          return;
        }
        if (failed > 0) {
          window.alert(`${failed}장은 불러오지 못해 건너뛰었어요.`);
        }

        // Commit: drop the built pages in starting at the selected page,
        // keeping everything before the start and after the replaced page.
        setPages((prev) => [
          ...prev.slice(0, insertAt),
          ...built,
          ...prev.slice(replaceActive ? curIdx + 1 : insertAt),
        ]);

        // Jump to the first generated page (now at insertAt).
        await api.load(built[0].data);
        setActiveIndex(insertAt);
        setSelected(null);
        setBgColor("#ffffff");
      } finally {
        bulkBuildingRef.current = false;
      }
    },
    [pages, PAGE_W],
  );

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

      // 3) Spread auto-shift: a wide image duplicated becomes the facing half
      //    of a continuous spread. By default the source is the LEFT half and
      //    the copy reveals the RIGHT half (`srcLeft − PAGE_W`, placed AFTER);
      //    if the source is already the RIGHT half of a spread, the copy reveals
      //    the LEFT half (`srcLeft + PAGE_W`, placed BEFORE). Unlike before this
      //    works at ANY source offset (not just a perfectly edge-aligned image)
      //    and LINKS both halves with a shared spreadId, so nudging one keeps
      //    the other aligned at the fold — exactly like 전체추가.
      let insertBefore = false;
      let spreadId: string | undefined;
      let sourceSide: "left" | "right" | undefined;
      if (clonedData?.objects) {
        const imgObj = clonedData.objects.find(
          (o) => o.type === "image" || o.type === "Image",
        );
        if (imgObj) {
          const scaledW =
            Number(imgObj.width ?? 0) * Number(imgObj.scaleX ?? 1);
          if (scaledW > PAGE_W + 1) {
            const srcLeft = Number(imgObj.left ?? 0);
            const copyLeftHalf = source.spreadSide === "right";
            insertBefore = copyLeftHalf;
            imgObj.left = copyLeftHalf ? srcLeft + PAGE_W : srcLeft - PAGE_W;
            spreadId =
              source.spreadId ?? Math.random().toString(36).slice(2, 10);
            sourceSide = copyLeftHalf ? "right" : "left";
          }
        }
      }
      const copySide: "left" | "right" | undefined =
        sourceSide === "left"
          ? "right"
          : sourceSide === "right"
            ? "left"
            : undefined;

      // 4) Commit: keep the source (now linked, with snapshot if it was active)
      //    and insert the cloned half next to it → spread reads [left][right].
      const updatedSource: EditorPage = spreadId
        ? { ...source, spreadId, spreadSide: sourceSide }
        : source;
      const newPage: EditorPage = {
        id: Math.random().toString(36).slice(2, 10),
        kind: "content",
        data: clonedData,
        ...(spreadId ? { spreadId, spreadSide: copySide } : {}),
      };
      const insertAt = insertBefore ? idx : idx + 1;
      setPages((prev) => {
        const next = prev.map((p, i) => (i === idx ? updatedSource : p));
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

  // Apply a text-property patch honoring the "전체" toggle: when it's on the
  // patch hits every text object on every page, otherwise just the selection.
  const applyTextPatch = useCallback(
    (patch: Record<string, unknown>) => {
      if (applyFontAll) {
        void applyToAllText((t) => t.set(patch));
      } else {
        updateSelected(patch);
      }
    },
    [applyFontAll, applyToAllText, updateSelected],
  );

  // Drop shadow on the selected text (fabric.Shadow). Pass on:false to clear.
  // Respects the "전체" toggle just like the other text properties.
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
      let shadowVal: object | null = null;
      if (p.on) {
        const fabric = await import("fabric");
        const rad = (p.angle * Math.PI) / 180;
        shadowVal = new fabric.Shadow({
          color: rgbaStr(p.hex, p.opacity),
          blur: p.blur,
          offsetX: Math.round(Math.cos(rad) * p.distance),
          offsetY: Math.round(Math.sin(rad) * p.distance),
        });
      }
      if (applyFontAll) {
        await applyToAllText((t) => t.set("shadow", shadowVal));
        return;
      }
      selected.set("shadow", shadowVal);
      api.canvas.requestRenderAll();
      setChangeTick((x) => x + 1);
    },
    [selected, applyFontAll, applyToAllText],
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
    await onFinish(finalPages, pageW, layout, captionText);
  }, [pages, activeIndex, onFinish, pageW, layout, captionText]);

  // 임시저장: snapshot the current page, then hand all pages to the parent to
  // persist as a cloud draft. Shows a transient "저장됨 ✓" on success.
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const handleSaveDraft = useCallback(async (): Promise<boolean> => {
    if (!onSaveDraft) return false;
    const api = apiRef.current;
    if (!api) return false;
    const data = api.serialize();
    const thumb = api.toPng(0.2);
    const finalPages = pages.map((p, i) =>
      i === activeIndex ? { ...p, data, thumb } : p,
    );
    setPages(finalPages);
    setDraftState("saving");
    try {
      await onSaveDraft(finalPages, pageW, layout, captionText);
      setDraftState("saved");
      window.setTimeout(() => setDraftState("idle"), 2000);
      return true;
    } catch (err) {
      setDraftState("idle");
      alert((err as Error).message);
      return false;
    }
  }, [pages, activeIndex, onSaveDraft, pageW, layout, captionText]);

  // 내서재로: 임시저장한 다음 내 서재로 이동. 저장이 실패하면(작업 유실 방지)
  // 이동하지 않는다.
  const router = useRouter();
  const handleSaveAndLibrary = useCallback(async () => {
    const ok = await handleSaveDraft();
    if (ok) router.push("/library");
  }, [handleSaveDraft, router]);

  // Close the mobile properties drawer (keeps the canvas selection so the user
  // can reopen "편집하기" to keep editing the same object).
  const closeProps = useCallback(() => setPropsOpen(false), []);

  const isText = useMemo(
    () =>
      selected?.type === "i-text" ||
      selected?.type === "text" ||
      selected?.type === "textbox",
    [selected],
  );
  const isShape = useMemo(
    () => selected?.type === "rect" || selected?.type === "circle",
    [selected],
  );
  const isImage = useMemo(() => selected?.type === "image", [selected]);
  const canFit = isImage || isShape;

  // Outline + shadow state for the text props UI (re-derived each render).
  // NOTE: Fabric defaults strokeWidth to 1 even with no stroke colour, so the
  // outline counts as "on" only when an actual stroke colour is set.
  const rawStroke = (selected as unknown as { stroke?: string | null } | null)
    ?.stroke;
  const strokeColor = rawStroke || "#ffffff";
  const strokeWidth =
    (selected as unknown as { strokeWidth?: number } | null)?.strokeWidth ?? 0;
  const outlineOn = !!rawStroke && strokeWidth > 0;

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
          <SlidersHorizontal size={14} /> 편집
        </button>
        <div className="ed-spacer" />
        <div className="ed-save-group">
          <button
            type="button"
            className="ed-draft"
            onClick={() => setCoverPromptOpen(true)}
            title="앞/뒤 표지 이미지 생성 프롬프트(대본 포함) 복사하기"
          >
            <BookOpen size={16} />
            <span className="ed-draft__label">표지</span>
          </button>
          <button
            type="button"
            className="ed-draft"
            onClick={() => setThumbOpen(true)}
            title="표지로 썸네일(16:9·9:16·1:1·판형) 만들기"
          >
            <ImageIcon size={16} />
            <span className="ed-draft__label">썸네일</span>
          </button>
          <button
            type="button"
            className="ed-draft ed-step ed-step--1"
            title="폴더를 선택하면 표지(첫 이미지)를 뺀 나머지를 전체 왼쪽정렬+복제(스프레드)로 자동 편집합니다"
            onClick={() => folderInputRef.current?.click()}
          >
            <span className="ed-step-num" aria-hidden>
              1
            </span>
            <span className="ed-draft__label">전체추가</span>
          </button>
          <button
            type="button"
            className="ed-draft ed-step ed-step--2"
            onClick={openContentModal}
            disabled={exporting}
            title="페이지별 내용(텍스트)을 한 번에 추가"
          >
            <span className="ed-step-num" aria-hidden>
              2
            </span>
            <span className="ed-draft__label">내용추가</span>
          </button>
          {onSaveDraft && (
            <button
              type="button"
              className="ed-draft ed-step ed-step--3"
              onClick={() => void handleSaveDraft()}
              disabled={exporting || draftState === "saving"}
              title="작업을 내 서재에 임시저장 (공개 안 됨)"
            >
              <span className="ed-step-num" aria-hidden>
                3
              </span>
              <span className="ed-draft__label">
                {draftState === "saving"
                  ? "저장 중…"
                  : draftState === "saved"
                    ? "저장됨 ✓"
                    : "임시저장"}
              </span>
            </button>
          )}
          <button
            type="button"
            className="ed-draft ed-step ed-step--4"
            onClick={() => {
              if (!bookId) {
                alert(
                  "먼저 '임시저장'을 눌러 책을 저장한 뒤 나레이션을 넣을 수 있어요.",
                );
                return;
              }
              setNarrEditorOpen(true);
            }}
            disabled={exporting}
            title="음성 한 파일을 구간으로 나눠 페이지별 나레이션으로 넣기"
          >
            <span className="ed-step-num" aria-hidden>
              4
            </span>
            <span className="ed-draft__label">나레이션</span>
          </button>
          <button
            type="button"
            className={`ed-draft ed-step ed-step--5${hasBgm ? " is-on" : ""}`}
            disabled={exporting}
            title={
              hasBgm
                ? "배경음악 등록됨 (눌러서 교체/제거)"
                : "내 파일을 올리거나 공용음악에서 골라 배경음악 넣기"
            }
            onClick={() => {
              if (!bookId) {
                alert(
                  "먼저 '임시저장'을 눌러 책을 저장한 뒤 배경음악을 넣을 수 있어요.",
                );
                return;
              }
              setBgmModalOpen(true);
            }}
          >
            <span className="ed-step-num" aria-hidden>
              5
            </span>
            <span className="ed-draft__label">
              {hasBgm ? "배경음악 ✓" : "배경음악"}
            </span>
          </button>
          {onSaveDraft && (
            <button
              type="button"
              className="ed-draft"
              onClick={() => void handleSaveAndLibrary()}
              disabled={exporting || draftState === "saving"}
              title="임시저장한 뒤 내 서재로 이동"
            >
              <BookMarked size={16} />
              <span className="ed-draft__label">내서재</span>
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
              "출판심사 준비 중…"
            ) : (
              <span>
                출판<span className="ed-finish__suffix">심사</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Creative tools + undo/redo live at the top of the body (canvas
          column) — on desktop and mobile alike — not in the header. */}
      <div className="ed-toolbar">
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
          {/* 전체추가 버튼은 헤더(저장그룹, 단계 ①)로 옮겨졌습니다. 이 숨은 폴더
              input은 여기 남아 folderInputRef로 열립니다. */}
          <input
            ref={folderInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              const fs = e.target.files;
              // Snapshot into an array NOW — `fs` is a live FileList tied to
              // the input, so resetting value below would empty it before the
              // async handler reads it.
              const files = fs ? Array.from(fs) : [];
              e.target.value = "";
              if (files.length) void addAllFromFolder(files);
              else
                window.alert("선택된 파일이 없어요. 폴더를 다시 선택해 주세요.");
            }}
          />
          <button
            type="button"
            className="ed-pagelist__add"
            onClick={() => void addPage()}
          >
            추가
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
                width: Math.floor(PAGE_W * displayScale),
                height: Math.floor(PAGE_H * displayScale),
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
            // floor so the (continuous) scaled canvas always fully covers the
            // frame — otherwise sub-pixel rounding shows the white frame edge.
            width: Math.floor(PAGE_W * displayScale),
            height: Math.floor(PAGE_H * displayScale),
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
                width: Math.floor(PAGE_W * displayScale),
                height: Math.floor(PAGE_H * displayScale),
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
          <div className="ed-props__bar-actions">
            {selected && (
              <button
                type="button"
                className="ed-props__del"
                onClick={deleteSelected}
                title="선택한 요소 삭제"
                aria-label="삭제"
              >
                <Trash2 size={16} /> 삭제
              </button>
            )}
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
                rows={5}
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
                  if (applyFontAll) {
                    await applyFontToAll(family);
                    return;
                  }
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
                <label
                  className="ed-font-all"
                  title="체크한 뒤 글꼴·글씨색·크기·두께·줄간격·자간·정렬·외곽선·그림자를 바꾸면 모든 페이지의 글씨에 적용됩니다"
                >
                  <input
                    type="checkbox"
                    checked={applyFontAll}
                    onChange={(e) => setApplyFontAll(e.target.checked)}
                  />
                  전체
                </label>
                <ColorField
                  className="ed-swatch ed-swatch--square"
                  value={
                    (selected as unknown as { fill: string }).fill || "#000000"
                  }
                  onChange={(c) => applyTextPatch({ fill: c })}
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
                onChange={(n) => applyTextPatch({ fontSize: n })}
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
                  onClick={() => applyTextPatch({ fontWeight: "normal" })}
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
                  onClick={() => applyTextPatch({ fontWeight: "bold" })}
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
                  1.5
                }
                min={0.6}
                max={3}
                step={0.1}
                decimals={1}
                onChange={(n) => applyTextPatch({ lineHeight: n })}
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
                onChange={(n) => applyTextPatch({ charSpacing: n })}
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
                    onClick={() => applyTextPatch({ textAlign: a })}
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
                  onClick={() => {
                    if (outlineOn) {
                      applyTextPatch({ strokeWidth: 0, stroke: null });
                    } else {
                      applyTextPatch({
                        strokeWidth: 4,
                        stroke: strokeColor,
                        paintFirst: "stroke",
                      });
                      setOutlineOpen(true);
                    }
                  }}
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
                        applyTextPatch({ stroke: c, paintFirst: "stroke" })
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
                      applyTextPatch({
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
                  onClick={() => {
                    const next = !shadow.on;
                    void applyShadowParams({ ...shadow, on: next });
                    if (next) setShadowOpen(true);
                  }}
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
          </>
        )}
      </aside>

      {contentModalOpen && (
        <ContentTextModal
          spreads={captionSpreads}
          text={captionText}
          selected={selectedPages}
          busy={applyingCaptions}
          onToggle={(pageId) =>
            setSelectedPages((prev) =>
              prev.includes(pageId)
                ? prev.filter((k) => k !== pageId)
                : [...prev, pageId],
            )
          }
          onText={setCaptionText}
          onApply={() => void applyCaptions()}
          onClearAll={() => void clearAllCaptions()}
          onClose={() => setContentModalOpen(false)}
        />
      )}

      {narrEditorOpen && bookId && (
        <NarrationEditorModal
          bookId={bookId}
          spreads={captionSpreads}
          onApplied={markNarrationPages}
          onClose={() => setNarrEditorOpen(false)}
        />
      )}

      {bgmModalOpen && bookId && (
        <BookMusicModal
          bookId={bookId}
          currentKey={bgmKey}
          onChanged={setBgmKey}
          onClose={() => setBgmModalOpen(false)}
        />
      )}

      {thumbOpen && (
        <ThumbnailModal
          coverPage={pages[0]}
          pageW={pageW}
          onClose={() => setThumbOpen(false)}
        />
      )}

      {coverPromptOpen && (
        <CoverPromptModal
          script={captionText}
          onClose={() => setCoverPromptOpen(false)}
        />
      )}
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
