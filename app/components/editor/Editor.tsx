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
  Plus,
  Square as SquareIcon,
  Trash2,
  Type as TypeIcon,
  X,
} from "lucide-react";
import FabricCanvas, {
  type FabricApi,
  type Guide,
} from "./FabricCanvas";
import {
  type EditorPage,
  PAGE_H,
  PAGE_W,
  makePage,
} from "../../lib/editor-types";
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

type Props = {
  onFinish: (pages: EditorPage[]) => Promise<void> | void;
  exporting?: boolean;
};

export default function Editor({ onFinish, exporting = false }: Props) {
  // Restore the previous session if present (Editor is client-only via
  // dynamic({ ssr: false }) so localStorage access here is safe).
  const [pages, setPages] = useState<EditorPage[]>(() => {
    const saved = loadEditorState();
    if (saved && saved.pages.length > 0) return saved.pages;
    return [{ ...makePage("cover") }, { ...makePage("content") }];
  });
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    const saved = loadEditorState();
    return saved && saved.pages.length > 0
      ? Math.min(saved.activeIndex, saved.pages.length - 1)
      : 0;
  });
  const [selected, setSelected] = useState<FabricObject | null>(null);
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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  // Refs so the debounced snapshot callback can read the latest active page
  // index without re-binding (which would clear the pending timer).
  const activeIndexRef = useRef(activeIndex);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);
  const snapshotTimerRef = useRef<number | null>(null);

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
      });
    }, 500);
    return () => window.clearTimeout(id);
  }, [pages, activeIndex]);

  // Snapshot the live Fabric canvas into pages[activeIndex] (debounced) so
  // edits within a single page are persisted too — not only structural
  // changes like add/remove. Without this, only "switch page" actions would
  // commit the canvas into the pages state.
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
      setPages((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, data, thumb } : p)),
      );
    }, 700);
  }, []);

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

  // Render the partner page into a PNG so we can show it side-by-side with
  // the editable active canvas. Cheap because we reuse an offscreen Fabric
  // static canvas and only regenerate when the partner changes.
  useEffect(() => {
    if (!spreadMode || partnerIndex === null) {
      setPartnerPng(null);
      return;
    }
    const partner = pages[partnerIndex];
    if (!partner) {
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
      if (partner.data) {
        await off.loadFromJSON(partner.data);
      }
      off.renderAll();
      const png = off.toDataURL({ format: "png", multiplier: 1 });
      off.dispose();
      if (!cancelled) setPartnerPng(png);
    })();
    return () => {
      cancelled = true;
    };
  }, [spreadMode, partnerIndex, pages]);

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
    const t = new fabric.IText("여기에 글자를 적어요", {
      left: 80,
      top: 80,
      fontSize: 48,
      fontFamily: DEFAULT_FONT.family,
      fill: "#2c1d10",
      editable: true,
    });
    api.canvas.add(t);
    api.canvas.setActiveObject(t);
    api.canvas.requestRenderAll();
  }, []);

  const addImageFile = useCallback(async (file: File) => {
    const api = apiRef.current;
    if (!api?.canvas) return;
    const fabric = await import("fabric");
    const url = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(file);
    });
    const img = await fabric.FabricImage.fromURL(url, {
      crossOrigin: "anonymous",
    });
    // Place the image at its native size, centered on the page. Lets the
    // user keep their original resolution; they can resize or use the fit
    // buttons (전체/위/아래/왼쪽/오른쪽) afterward.
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
              fill: "#ffd05f",
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
   * operate completely independently. If the source has a wide image
   * (scaledW > PAGE_W), the copy auto-shifts that image left by PAGE_W so
   * the previously-off-canvas right portion becomes visible — useful for
   * building continuous spreads. For perfect spread continuity, align the
   * source's image to the left edge first (drag, or click the 왼쪽 button).
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

      // 3) Spread auto-shift (opt-in): only kick in for wide images that the
      //    user has explicitly left-aligned (left === 0) — that's the signal
      //    "this is the left half of a spread". Otherwise the copy keeps the
      //    same position as the source so the image stays visible in place.
      if (clonedData?.objects) {
        for (const obj of clonedData.objects) {
          const type = obj.type as string | undefined;
          if (type === "image" || type === "Image") {
            const baseW = Number(obj.width ?? 0);
            const scaleX = Number(obj.scaleX ?? 1);
            const left = Number(obj.left ?? 0);
            if (baseW * scaleX > PAGE_W + 1 && left === 0) {
              obj.left = -PAGE_W;
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
      const insertAt = idx + 1;
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
    await onFinish(finalPages);
  }, [pages, activeIndex, onFinish]);

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

  return (
    <div className="ed-shell">
      <div className="ed-topbar">
        <Link href="/" className="ed-home">
          <ArrowLeft size={14} /> 처음으로
        </Link>
        <button
          type="button"
          className="ed-home"
          onClick={resetEditor}
          title="저장된 작업을 지우고 빈 책으로 시작"
        >
          <Trash2 size={14} /> 새 책
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
          <label className="ed-tool" style={{ paddingRight: 10 }}>
            <Palette size={16} /> 배경
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBg(e.target.value)}
              style={{
                marginLeft: 6,
                width: 24,
                height: 22,
                border: 0,
                background: "transparent",
                padding: 0,
                cursor: "pointer",
              }}
            />
          </label>
          <button
            type="button"
            className={`ed-tool${spreadMode ? " is-active" : ""}`}
            onClick={() => setSpreadMode((v) => !v)}
            title="펼침면 미리보기 (좌·우 페이지를 같이 보기)"
          >
            <Columns2 size={16} /> {spreadMode ? "한 페이지" : "스프레드"}
          </button>
        </div>
        <div className="ed-spacer" />
        <button
          type="button"
          className="ed-finish"
          onClick={handleFinish}
          disabled={exporting}
        >
          <BookOpen size={16} />
          {exporting ? "책으로 만드는 중…" : "완성 → 책으로"}
        </button>
      </div>

      <aside className="ed-pagelist">
        <div className="ed-pagelist__head">
          <span>페이지</span>
          <button
            type="button"
            className="ed-pagelist__add"
            onClick={() => void addPage()}
          >
            <Plus size={12} /> 추가
          </button>
        </div>
        <div className="ed-pagelist__items">
          {pages.map((p, i) => (
            <div
              key={p.id}
              className={`ed-page-thumb${
                i === activeIndex ? " is-active" : ""
              }${dragSrc === i ? " is-dragging" : ""}${
                dropTarget === i && dragSrc !== null && dragSrc !== i
                  ? " is-drop-target"
                  : ""
              }`}
              onClick={() => void switchTo(i)}
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

      <aside className="ed-props">
        <h3 className="ed-props__title">속성</h3>
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
            </div>
            <div className="ed-props__group">
              <label className="ed-props__label">글자 크기</label>
              <input
                type="number"
                className="ed-input"
                min={8}
                max={300}
                value={
                  (selected as unknown as { fontSize: number }).fontSize ?? 24
                }
                onChange={(e) =>
                  updateSelected({ fontSize: Number(e.target.value) })
                }
              />
            </div>
            <div className="ed-props__group">
              <label className="ed-props__label">글자 색</label>
              <div className="ed-props__row">
                <input
                  type="color"
                  className="ed-input"
                  value={
                    (selected as unknown as { fill: string }).fill || "#000000"
                  }
                  onChange={(e) => updateSelected({ fill: e.target.value })}
                />
                <input
                  className="ed-input"
                  value={
                    (selected as unknown as { fill: string }).fill || "#000000"
                  }
                  onChange={(e) => updateSelected({ fill: e.target.value })}
                />
              </div>
            </div>
            <div className="ed-props__group">
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
          </>
        )}

        {selected && isShape && (
          <>
            <div className="ed-props__group">
              <label className="ed-props__label">색</label>
              <div className="ed-props__row">
                <input
                  type="color"
                  className="ed-input"
                  value={
                    (selected as unknown as { fill: string }).fill || "#ffd05f"
                  }
                  onChange={(e) => updateSelected({ fill: e.target.value })}
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
              <label className="ed-props__label">투명도</label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(
                  ((selected as unknown as { opacity?: number }).opacity ??
                    1) * 100,
                )}
                onChange={(e) =>
                  updateSelected({ opacity: Number(e.target.value) / 100 })
                }
                style={{ width: "100%" }}
              />
            </div>
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
