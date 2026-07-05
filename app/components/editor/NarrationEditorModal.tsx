"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Pause,
  Play,
  Redo2,
  Scissors,
  Trash2,
  Undo2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import {
  detectSpeechRegions,
  encodeSlicesToMp3,
} from "../../lib/narration-audio";
import { getNarrationUrls, removeNarration, uploadNarration } from "../../lib/store";
import type { BookLayout } from "../../lib/book-types";
import { orderedCells, type SpreadRow } from "./ContentTextModal";

type Props = {
  bookId: string;
  /** Same page-grid the 내용추가 modal uses (content pages, cover excluded). */
  spreads: SpreadRow[];
  /** Reading layout. Webtoon has no left/right halves, so the sequential
   *  auto-matching (built for 그림책 spreads) is skipped — every scene is
   *  matched by hand instead. */
  layout: BookLayout;
  onClose: () => void;
  onApplied: (pageIndices: number[]) => void;
};

type Seg = { id: string; start: number; end: number };

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

const REGION_COLOR = "rgba(240, 111, 95, 0.22)";

export default function NarrationEditorModal({
  bookId,
  spreads,
  layout,
  onClose,
  onApplied,
}: Props) {
  const isWebtoon = layout === "webtoon";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveWrapRef = useRef<HTMLDivElement | null>(null);
  // Horizontal zoom (px per second). minZoomRef = the "fit to container" level.
  const zoomRef = useRef<number>(0);
  const minZoomRef = useRef<number>(0);
  const wsRef = useRef<any>(null);
  const regionsRef = useRef<any>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const urlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const cells = orderedCells(spreads); // content pages in order

  // 매칭편집(default): upload audio files into a pool on the right, then select
  // a page and click a pooled audio to attach it. 통편집: one audio split into
  // segments matched to pages (the original flow).
  const [mode, setMode] = useState<"match" | "whole">("whole");
  type PoolItem = { id: string; file: File; url: string; name: string };
  const [pool, setPool] = useState<PoolItem[]>([]);
  // pageId → pool item id (a page holds at most one audio).
  const [pageToPool, setPageToPool] = useState<Record<string, string>>({});
  // Pages that already have a saved narration on the server (badge + playback).
  const [savedPages, setSavedPages] = useState<Set<string>>(new Set());
  // pageId → presigned URL of that page's saved narration, for listening.
  const [savedUrls, setSavedUrls] = useState<Record<string, string>>({});
  const matchInputRef = useRef<HTMLInputElement | null>(null);
  const poolUrlsRef = useRef<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const fileName = file?.name ?? null;
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [segs, setSegs] = useState<Seg[]>([]);
  // The page currently being targeted: click a page, then click segments to
  // attach them to it. A page may hold several segments.
  const [activePage, setActivePage] = useState<string | null>(
    cells[0]?.id ?? null,
  );
  // segmentId → pageId. Each segment belongs to at most one page; a page can
  // own many segments.
  const [segToPage, setSegToPage] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<{ cur: number; total: number } | null>(
    null,
  );
  // Waveform region currently "picked" (blue outline): makes the slice being
  // adjusted readable and its resize handles easy to find.
  const [selectedSegId, setSelectedSegId] = useState<string | null>(null);
  // Bulk-delete progress for the saved-narration list (separate from
  // `progress`, which drives the footer button label).
  const [deleting, setDeleting] = useState<{ cur: number; total: number } | null>(
    null,
  );

  // ----- Undo/redo (통편집 waveform) ---------------------------------------
  // Snapshots of the whole edit state: segments + their page matching. Every
  // mutating operation pushes the state it is ABOUT to change (so ⌘Z restores
  // it); redo holds states walked back over. Region ids are preserved across
  // restores so segToPage keys stay valid.
  type Snap = { segs: Seg[]; segToPage: Record<string, string> };
  const undoRef = useRef<Snap[]>([]);
  const redoRef = useRef<Snap[]>([]);
  // Pre-resize snapshot: captured when a resize handle is grabbed, committed
  // to the undo stack when the gesture ends (region-updated).
  const pendingSnapRef = useRef<Snap | null>(null);
  // Mirror of segToPage readable from wavesurfer event closures (state would
  // be stale there).
  const segToPageRef = useRef(segToPage);
  useEffect(() => {
    segToPageRef.current = segToPage;
  }, [segToPage]);
  // Stack sizes as state, purely to enable/disable the undo/redo buttons.
  const [hist, setHist] = useState({ undo: 0, redo: 0 });
  const bumpHist = () =>
    setHist({ undo: undoRef.current.length, redo: redoRef.current.length });

  const takeSnap = (): Snap => ({
    segs: [...(regionsRef.current?.getRegions?.() ?? [])]
      .map((r: any) => ({ id: r.id, start: r.start, end: r.end }))
      .sort((a: Seg, b: Seg) => a.start - b.start),
    segToPage: { ...segToPageRef.current },
  });

  const snapEqual = (a: Snap, b: Snap) =>
    a.segs.length === b.segs.length &&
    a.segs.every((s, i) => {
      const o = b.segs[i];
      return (
        s.id === o.id &&
        Math.abs(s.start - o.start) < 1e-6 &&
        Math.abs(s.end - o.end) < 1e-6
      );
    }) &&
    Object.keys(a.segToPage).length === Object.keys(b.segToPage).length &&
    Object.entries(a.segToPage).every(([k, v]) => b.segToPage[k] === v);

  const pushHistory = () => {
    const snap = takeSnap();
    const top = undoRef.current[undoRef.current.length - 1];
    // The previous op turned out to be a no-op → its snapshot already sits on
    // top; don't stack a duplicate (it would make one ⌘Z feel dead).
    if (top && snapEqual(top, snap)) return;
    undoRef.current.push(snap);
    if (undoRef.current.length > 100) undoRef.current.shift();
    redoRef.current = [];
    bumpHist();
  };

  const applySnap = (snap: Snap) => {
    const regions = regionsRef.current;
    if (!regions) return;
    regions.clearRegions();
    for (const s of snap.segs) {
      regions.addRegion({
        id: s.id,
        start: s.start,
        end: s.end,
        color: REGION_COLOR,
        drag: false,
      });
    }
    // Update the ref synchronously so an immediately following undo/redo
    // snapshots the restored mapping, not the stale one.
    segToPageRef.current = { ...snap.segToPage };
    setSegToPage({ ...snap.segToPage });
    syncSegs();
  };

  const undoEdit = () => {
    const prev = undoRef.current.pop();
    if (!prev) return;
    redoRef.current.push(takeSnap());
    applySnap(prev);
    bumpHist();
  };

  const redoEdit = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(takeSnap());
    applySnap(next);
    bumpHist();
  };
  // -------------------------------------------------------------------------

  // Segments owned by a page, in time order (segs is already sorted by start).
  const segsForPage = (pageId: string) =>
    segs.filter((s) => segToPage[s.id] === pageId);
  const filledPages = cells.filter((c) => segsForPage(c.id).length > 0);

  // Regions must never overlap: overlapping regions made "여기서 자르기"
  // silently miss (only the first region under the cursor was split, the
  // stacked one kept covering it) and duplicated the same audio span across
  // pages. Whenever a region edge is resized over a neighbor, the CHANGED
  // region yields — it's clipped to the free gap around it, and removed if
  // (almost) nothing remains.
  const normalizeRegion = (changed: any) => {
    const regions = regionsRef.current;
    if (!regions || !changed || changed.isRemoved) return;
    const others = (regions.getRegions?.() ?? []).filter(
      (r: any) => r.id !== changed.id && !r.isRemoved,
    );
    let start = changed.start;
    let end = changed.end;
    for (const o of others) {
      if (o.end <= start || o.start >= end) continue; // no overlap
      // Clip against this neighbor, keeping the larger surviving side.
      const leftPart = Math.min(end, o.start) - start;
      const rightPart = end - Math.max(start, o.end);
      if (leftPart >= rightPart) end = Math.min(end, o.start);
      else start = Math.max(start, o.end);
    }
    if (end - start < 0.05) {
      changed.remove();
      return;
    }
    if (start !== changed.start || end !== changed.end) {
      changed.setOptions({ start, end });
    }
  };

  // Region bodies must not swallow pointer events: once cuts cover the whole
  // waveform, the region elements sat on top of it and the red line could no
  // longer be grabbed/scrubbed. Let everything pass through to the waveform
  // (click + drag = move the red line) and keep only the resize handles
  // interactive. Region "selection" is derived from the seek position instead
  // of region click events (see the "interaction" handler).
  const passThroughRegion = (r: any) => {
    const el = r.element as HTMLElement | undefined;
    if (!el) return;
    el.style.pointerEvents = "none";
    el.querySelectorAll('[part*="region-handle"]').forEach((h) => {
      const handle = h as HTMLElement;
      handle.style.pointerEvents = "all";
      // Snapshot the pre-resize state the moment a handle is grabbed; it goes
      // onto the undo stack when the gesture actually changed something
      // (region-updated fires on gesture end).
      handle.addEventListener("pointerdown", () => {
        pendingSnapRef.current = takeSnap();
      });
    });
  };

  // Paint the picked region blue (outline + tint) and reset the rest. Inline
  // styles because region elements live inside wavesurfer's shadow DOM.
  const applySelection = (id: string | null) => {
    const regs = regionsRef.current?.getRegions?.() ?? [];
    for (const r of regs) {
      const el = r.element as HTMLElement | undefined;
      if (!el) continue;
      const on = r.id === id;
      el.style.outline = on ? "2px solid #2b7fff" : "";
      el.style.outlineOffset = on ? "-2px" : "";
      el.style.backgroundColor = on ? "rgba(43, 127, 255, 0.2)" : REGION_COLOR;
    }
  };

  // Re-paint the highlight whenever the selection or the region set changes
  // (regions are re-created on cut, losing their inline styles).
  useEffect(() => {
    applySelection(selectedSegId);
  }, [selectedSegId, segs]);

  const syncSegs = () => {
    const regs = regionsRef.current?.getRegions?.() ?? [];
    setSegs(
      regs
        .map((r: any) => ({ id: r.id, start: r.start, end: r.end }))
        .sort((a: Seg, b: Seg) => a.start - b.start),
    );
    // Drop assignments (and the picked highlight) whose region no longer exists.
    const live = new Set(regs.map((r: any) => r.id));
    setSelectedSegId((prev) => (prev && live.has(prev) ? prev : null));
    setSegToPage((prev) => {
      const next: Record<string, string> = {};
      for (const [segId, pageId] of Object.entries(prev)) {
        if (live.has(segId)) next[segId] = pageId;
      }
      return next;
    });
  };

  const teardown = useCallback(() => {
    try {
      wsRef.current?.destroy?.();
    } catch {
      /* ignore */
    }
    wsRef.current = null;
    regionsRef.current = null;
    bufferRef.current = null;
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    (async () => {
      teardown();
      setReady(false);
      setSegs([]);
      setSegToPage({});
      setPlaying(false);
      // Fresh file, fresh history.
      undoRef.current = [];
      redoRef.current = [];
      pendingSnapRef.current = null;
      setHist({ undo: 0, redo: 0 });

      const WaveSurfer = (await import("wavesurfer.js")).default;
      const RegionsPlugin = (
        await import("wavesurfer.js/dist/plugins/regions.esm.js")
      ).default;
      if (cancelled || !containerRef.current) return;

      const ws = WaveSurfer.create({
        container: containerRef.current,
        height: 72,
        waveColor: "#9ad9c9",
        progressColor: "#1f9e7f",
        cursorColor: "#e2614a",
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        // Dragging on the waveform scrubs the red line — everywhere, since
        // region bodies pass pointer events through (passThroughRegion).
        // Drag-selection of regions is intentionally NOT enabled: it fought
        // with scrubbing and stacked overlapping regions on top of existing
        // ones — segments come from 자동 분할 / 여기서 자르기 instead.
        dragToSeek: true,
      });
      const regions = ws.registerPlugin(RegionsPlugin.create());
      wsRef.current = ws;
      regionsRef.current = regions;

      ws.on("play", () => setPlaying(true));
      ws.on("pause", () => setPlaying(false));
      ws.on("finish", () => setPlaying(false));
      ws.on("ready", () => {
        bufferRef.current = ws.getDecodedData();
        setReady(true);
        // Baseline zoom = fit the whole clip to the container width.
        const w = containerRef.current?.clientWidth ?? 800;
        const dur = ws.getDuration() || 1;
        const fit = w / dur;
        zoomRef.current = fit;
        minZoomRef.current = fit;
      });
      regions.on("region-created", (r: any) => {
        passThroughRegion(r);
        normalizeRegion(r);
        syncSegs();
      });
      regions.on("region-updated", (r: any) => {
        // A resize gesture just ended → commit the pre-resize snapshot.
        if (pendingSnapRef.current) {
          undoRef.current.push(pendingSnapRef.current);
          if (undoRef.current.length > 100) undoRef.current.shift();
          pendingSnapRef.current = null;
          redoRef.current = [];
          bumpHist();
        }
        normalizeRegion(r);
        syncSegs();
      });
      regions.on("region-removed", syncSegs);
      // Clicking/dragging the waveform moves the red line (native seek); the
      // segment under the new position becomes the picked one. Region click
      // events can't be used for picking — region bodies pass pointer events
      // through so the red line stays grabbable everywhere.
      ws.on("interaction", (newTime: number) => {
        const regs = regionsRef.current?.getRegions?.() ?? [];
        const hit = regs.find(
          (r: any) => newTime >= r.start && newTime <= r.end,
        );
        setSelectedSegId(hit ? hit.id : null);
      });

      const url = URL.createObjectURL(file);
      urlRef.current = url;
      await ws.load(url);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => () => teardown(), [teardown]);

  // Ctrl/⌘ + mouse wheel over the waveform → zoom horizontally (stretch/shrink).
  // Native non-passive listener so we can preventDefault the page scroll.
  useEffect(() => {
    const el = waveWrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const ws = wsRef.current;
      if (!ws) return;

      // Alt + wheel → pan the waveform left/right.
      if (e.altKey) {
        e.preventDefault();
        const delta = e.deltaY || e.deltaX;
        ws.setScroll(ws.getScroll() + delta);
        return;
      }

      // Ctrl/⌘ + wheel → zoom horizontally (stretch/shrink).
      if (e.ctrlKey || e.metaKey) {
        const min = minZoomRef.current;
        if (!min) return;
        e.preventDefault();
        const cur = zoomRef.current || min;
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const next = Math.max(min, Math.min(min * 40, cur * factor));
        zoomRef.current = next;
        ws.zoom(next);
      }
      // plain scroll = normal behavior
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ready]);

  // Spacebar → play/pause (ignored while typing in an input/textarea).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      const ws = wsRef.current;
      if (!ws) return;
      e.preventDefault();
      ws.playPause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ctrl/⌘+Z → undo, Ctrl/⌘+Shift+Z (or Ctrl+Y) → redo, for the 통편집
  // waveform edits. Re-registered per render so the handler sees the current
  // undoEdit/redoEdit (they only touch refs, but keep it simple and fresh).
  useEffect(() => {
    if (mode !== "whole") return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k !== "z" && k !== "y") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      if (k === "y" || e.shiftKey) redoEdit();
      else undoEdit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const playPause = () => wsRef.current?.playPause?.();

  const autoSplit = () => {
    const buf = bufferRef.current;
    const regions = regionsRef.current;
    if (!buf || !regions) return;
    pushHistory();
    regions.clearRegions();
    setSegToPage({});
    for (const r of detectSpeechRegions(buf)) {
      regions.addRegion({
        start: r.start,
        end: r.end,
        color: REGION_COLOR,
        drag: false,
      });
    }
    syncSegs();
  };

  const clearAll = () => {
    pushHistory();
    regionsRef.current?.clearRegions?.();
    setSegToPage({});
    syncSegs();
  };

  // Razor cut at the red playhead line: split the segment under the cursor in
  // two at the current time. The first cut treats the whole clip as one
  // segment. After cutting, every segment is matched in time order to the next
  // LEFT (odd) page — 1쪽, 3쪽, 5쪽… — since a spread's scene lives on its left
  // half. The user can still re-target a page and click a segment to change it.
  const cutAtCursor = () => {
    const ws = wsRef.current;
    const regions = regionsRef.current;
    const buf = bufferRef.current;
    if (!ws || !regions || !buf) return;
    const dur = buf.duration;
    const t = ws.getCurrentTime?.() ?? 0;

    const inside = (r: any) => t > r.start + 0.05 && t < r.end - 0.05;
    let regs = regions.getRegions?.() ?? [];
    if (regs.length === 0) {
      // Nothing split yet → the whole clip is one segment to cut into.
      pushHistory();
      regions.addRegion({ start: 0, end: dur, color: REGION_COLOR, drag: false });
      regs = regions.getRegions?.() ?? [];
    } else if (regs.some(inside)) {
      pushHistory();
    } else {
      // Cut right on an existing edge (or outside every segment): nothing to
      // split — bail before the sequential re-match clobbers hand-made
      // assignments for no visible change.
      return;
    }
    // Every segment the red line currently sits inside (with a small margin so
    // a cut right on an existing edge is a no-op rather than a zero-length
    // seg). Plural on purpose: if older overlapping segments are still around,
    // splitting only the first one left the stacked one covering the cut and
    // the button looked dead. Remove them all first, then add the halves — the
    // region-created normalizer resolves any leftover overlap among the pieces.
    const targets = regs.filter(inside);
    const spans = targets.map((r: any) => ({ start: r.start, end: r.end }));
    for (const r of targets) r.remove();
    for (const { start, end } of spans) {
      regions.addRegion({ start, end: t, color: REGION_COLOR, drag: false });
      regions.addRegion({ start: t, end, color: REGION_COLOR, drag: false });
    }

    // 그림책: re-match every segment in time order to the odd (left) pages.
    // 웹툰: keep whatever the user assigned by hand — don't clobber it with a
    // sequential map. New segments just stay unassigned until matched.
    if (!isWebtoon) {
      const ordered = [...(regions.getRegions?.() ?? [])].sort(
        (a: any, b: any) => a.start - b.start,
      );
      const leftCells = cells.filter((c) => !c.isRight);
      const map: Record<string, string> = {};
      for (let i = 0; i < ordered.length && i < leftCells.length; i++) {
        map[ordered[i].id] = leftCells[i].id;
      }
      setSegToPage(map);
    }
    syncSegs();
  };

  const removeSeg = (id: string) => {
    const regs = regionsRef.current?.getRegions?.() ?? [];
    const r = regs.find((rr: any) => rr.id === id);
    if (!r) return;
    pushHistory();
    r.remove?.();
    syncSegs();
  };

  const playSeg = (id: string) => {
    const regs = regionsRef.current?.getRegions?.() ?? [];
    regs.find((r: any) => r.id === id)?.play?.();
  };

  // Click a segment → attach it to (or detach it from) the active page.
  const toggleSegAssign = (segId: string) => {
    if (!activePage) {
      alert("먼저 왼쪽에서 페이지를 선택하세요.");
      return;
    }
    pushHistory();
    setSegToPage((prev) => {
      if (prev[segId] === activePage) {
        const next = { ...prev };
        delete next[segId];
        return next;
      }
      return { ...prev, [segId]: activePage };
    });
  };

  // Seed which pages already have a saved narration (both modes: badge on the
  // page grid + a player to listen to what's saved).
  useEffect(() => {
    let cancelled = false;
    void getNarrationUrls(bookId).then((urls) => {
      if (cancelled) return;
      const s = new Set<string>();
      const m: Record<string, string> = {};
      for (const c of cells) {
        const u = urls[c.index];
        if (u) {
          s.add(c.id);
          m[c.id] = u;
        }
      }
      setSavedPages(s);
      setSavedUrls(m);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  // Revoke pooled object URLs on unmount.
  useEffect(
    () => () => {
      for (const u of poolUrlsRef.current) URL.revokeObjectURL(u);
    },
    [],
  );

  const isAudioFile = (f: File) =>
    f.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|aac)$/i.test(f.name);

  // Add picked files to the audio pool on the right.
  const addToPool = (files: FileList | File[]) => {
    const items: PoolItem[] = [];
    for (const f of Array.from(files)) {
      if (!isAudioFile(f)) continue;
      const url = URL.createObjectURL(f);
      poolUrlsRef.current.push(url);
      items.push({
        id: Math.random().toString(36).slice(2, 10),
        file: f,
        url,
        name: f.name,
      });
    }
    if (items.length === 0) {
      alert("음성 파일(MP3 등)만 올릴 수 있어요.");
      return;
    }
    setPool((prev) => [...prev, ...items]);
    // 그림책(spread/single): auto-assign each newly uploaded audio to the next
    // free LEFT (odd) page in order — 1쪽, 3쪽, 5쪽… — since a spread's scene
    // lives on its left half. 웹툰: no left/right halves and scene order rarely
    // matches file order, so we skip auto-assign and let the user match each
    // scene by hand.
    if (isWebtoon) return;
    setPageToPool((prev) => {
      const next = { ...prev };
      const leftCells = cells.filter((c) => !c.isRight);
      let ci = 0;
      for (const it of items) {
        while (ci < leftCells.length && next[leftCells[ci].id]) ci++;
        if (ci >= leftCells.length) break;
        next[leftCells[ci].id] = it.id;
        ci++;
      }
      return next;
    });
  };

  // Click a pooled audio → attach it to the active page (toggle off if same).
  const assignPoolToActive = (poolId: string) => {
    if (!activePage) {
      alert("먼저 왼쪽에서 페이지를 선택하세요.");
      return;
    }
    setPageToPool((prev) => {
      if (prev[activePage] === poolId) {
        const n = { ...prev };
        delete n[activePage];
        return n;
      }
      return { ...prev, [activePage]: poolId };
    });
  };

  const removeFromPool = (poolId: string) => {
    setPageToPool((prev) => {
      const n = { ...prev };
      for (const k of Object.keys(n)) if (n[k] === poolId) delete n[k];
      return n;
    });
    setPool((prev) => prev.filter((p) => p.id !== poolId));
  };

  // Delete the narration already saved on a page (server-side). Clears both the
  // saved badge and any pending pool assignment for that page.
  const deleteSavedNarration = async (cell: (typeof cells)[number]) => {
    if (saving) return;
    if (!confirm(`${cell.label}의 기존 나레이션을 지울까요?`)) return;
    setSaving(true);
    try {
      await removeNarration(bookId, cell.index);
      setSavedPages((prev) => {
        const n = new Set(prev);
        n.delete(cell.id);
        return n;
      });
      setSavedUrls((prev) => {
        if (!prev[cell.id]) return prev;
        const n = { ...prev };
        delete n[cell.id];
        return n;
      });
      setPageToPool((prev) => {
        if (!prev[cell.id]) return prev;
        const n = { ...prev };
        delete n[cell.id];
        return n;
      });
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Delete every narration saved on the server, one page at a time (the API
  // has no bulk endpoint). Pages that fail keep their badge so nothing is
  // silently lost.
  const deleteAllSaved = async () => {
    if (saving) return;
    const targets = cells.filter((c) => savedPages.has(c.id));
    if (targets.length === 0) return;
    if (!confirm(`저장된 나레이션 ${targets.length}개를 모두 지울까요?`)) return;
    setSaving(true);
    setDeleting({ cur: 0, total: targets.length });
    try {
      for (let i = 0; i < targets.length; i++) {
        const cell = targets[i];
        await removeNarration(bookId, cell.index);
        setSavedPages((prev) => {
          const n = new Set(prev);
          n.delete(cell.id);
          return n;
        });
        setSavedUrls((prev) => {
          if (!prev[cell.id]) return prev;
          const n = { ...prev };
          delete n[cell.id];
          return n;
        });
        setPageToPool((prev) => {
          if (!prev[cell.id]) return prev;
          const n = { ...prev };
          delete n[cell.id];
          return n;
        });
        setDeleting({ cur: i + 1, total: targets.length });
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
      setDeleting(null);
    }
  };

  // Save every page that has a pooled audio assigned to it.
  const applyMatch = async () => {
    const targets = cells
      .map((c) => {
        const poolId = pageToPool[c.id];
        const item = pool.find((p) => p.id === poolId);
        return item ? { cell: c, file: item.file } : null;
      })
      .filter((t): t is { cell: (typeof cells)[number]; file: File } => !!t);
    if (targets.length === 0) {
      alert("매칭된 음성이 없어요. 페이지를 고르고 음성을 눌러 주세요.");
      return;
    }
    setSaving(true);
    setProgress({ cur: 0, total: targets.length });
    const applied: number[] = [];
    try {
      for (let i = 0; i < targets.length; i++) {
        const { cell, file } = targets[i];
        await uploadNarration(bookId, cell.index, file);
        applied.push(cell.index);
        setSavedPages((prev) => new Set(prev).add(cell.id));
        setProgress({ cur: i + 1, total: targets.length });
      }
      onApplied(applied);
      alert(`${applied.length}개 페이지에 나레이션을 넣었어요!`);
      onClose();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  const apply = async () => {
    const buf = bufferRef.current;
    if (!buf) return;
    const targets = cells
      .map((c) => ({
        cell: c,
        ranges: segs.filter((s) => segToPage[s.id] === c.id),
      }))
      .filter((t) => t.ranges.length > 0);
    if (targets.length === 0) return;
    setProgress({ cur: 0, total: targets.length });
    const applied: number[] = [];
    try {
      for (let i = 0; i < targets.length; i++) {
        const { cell, ranges } = targets[i];
        const mp3 = await encodeSlicesToMp3(
          buf,
          ranges.map((r) => ({ start: r.start, end: r.end })),
        );
        const f = new File([mp3 as BlobPart], `${cell.index}.mp3`, {
          type: "audio/mpeg",
        });
        await uploadNarration(bookId, cell.index, f);
        applied.push(cell.index);
        setSavedPages((prev) => new Set(prev).add(cell.id));
        setProgress({ cur: i + 1, total: targets.length });
        await new Promise((r) => setTimeout(r, 0));
      }
      onApplied(applied);
      alert(`${applied.length}개 페이지에 나레이션을 넣었어요!`);
      onClose();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setProgress(null);
    }
  };

  // Every narration already saved on the server (both modes): one row per page
  // with a player and a delete button. This is what keeps previously-saved
  // narration visible when the modal is reopened later. Clicking the page
  // label also targets that page on the left.
  const savedCells = cells.filter((c) => savedPages.has(c.id));
  const savedList =
    savedCells.length > 0 ? (
      <div className="narr-ed__saved">
        <div className="narr-ed__saved-head">
          <span className="narr-ed__saved-label">
            🎙 저장된 나레이션 {savedCells.length}개
          </span>
          <button
            type="button"
            className="narr-ed__del-saved"
            disabled={saving}
            onClick={() => void deleteAllSaved()}
            title="저장된 나레이션 모두 지우기"
          >
            <Trash2 size={13} />{" "}
            {deleting
              ? `지우는 중 ${deleting.cur}/${deleting.total}…`
              : "전체 삭제"}
          </button>
        </div>
        <div className="narr-ed__saved-list">
          {savedCells.map((c) => (
            <div
              key={c.id}
              className={`narr-ed__saved-row${
                activePage === c.id ? " is-on" : ""
              }`}
            >
              <button
                type="button"
                className="narr-ed__saved-page"
                onClick={() => setActivePage(c.id)}
                title="이 페이지 선택"
              >
                {c.label}
              </button>
              {savedUrls[c.id] && (
                <audio
                  src={savedUrls[c.id]}
                  controls
                  preload="none"
                  className="narr-pool__player"
                />
              )}
              <button
                type="button"
                className="icon-btn icon-btn--delete"
                disabled={saving}
                onClick={() => void deleteSavedNarration(c)}
                title="저장된 나레이션 지우기"
                aria-label="삭제"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    ) : null;

  // 통편집 page cell (click to target, shows segment count).
  const renderCell = (cell: (typeof cells)[number] | null) => {
    if (!cell)
      return <span className="ed-cmodal__cell ed-cmodal__cell--gap" />;
    const isActive = activePage === cell.id;
    const count = segsForPage(cell.id).length;
    let posText: string;
    let badge: string | null = null;
    if (mode === "match") {
      const assigned = pool.find((p) => p.id === pageToPool[cell.id]);
      if (assigned) {
        posText = `🎵 ${assigned.name}`;
        badge = "🎙";
      } else if (savedPages.has(cell.id)) {
        posText = "🎙 음성 있음";
        badge = "🎙";
      } else {
        posText = isActive ? "음성을 누르세요" : "비어있음";
      }
    } else {
      if (count > 0) {
        posText = `구간 ${count}개 🎙`;
        badge = String(count);
      } else if (savedPages.has(cell.id)) {
        posText = "🎙 음성 있음";
        badge = "🎙";
      } else {
        posText = isActive ? "현재 페이지" : "비어있음";
      }
    }
    return (
      <button
        type="button"
        className={`ed-cmodal__cell${isActive ? " is-active" : ""}`}
        onClick={() => setActivePage(cell.id)}
      >
        <span className="ed-cmodal__cell-img">
          {cell.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cell.thumb} alt={cell.label} />
          ) : (
            <span className="ed-cmodal__cell-empty" />
          )}
        </span>
        <span className="ed-cmodal__cell-meta">
          <span className="ed-cmodal__cell-label">{cell.label}</span>
          <span className="ed-cmodal__cell-pos">{posText}</span>
        </span>
        {badge && <span className="ed-cmodal__order">{badge}</span>}
      </button>
    );
  };

  return (
    <div className="ed-cmodal-backdrop" onClick={onClose}>
      <div
        className="ed-cmodal ed-cmodal--narr"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ed-cmodal__head">
          <span>🎙 나레이션 편집</span>
          <div className="narr-ed__tabs">
            <button
              type="button"
              className={`narr-ed__tab${mode === "whole" ? " is-on" : ""}`}
              onClick={() => setMode("whole")}
            >
              통편집
            </button>
            <button
              type="button"
              className={`narr-ed__tab${mode === "match" ? " is-on" : ""}`}
              onClick={() => setMode("match")}
            >
              매칭편집
            </button>
          </div>
          <button
            type="button"
            className="ed-cmodal__x"
            onClick={onClose}
            aria-label="닫기"
            title="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {cells.length === 0 ? (
          <div className="ed-cmodal__empty">
            나레이션을 넣을 페이지가 없어요. 표지 외에 페이지를 먼저 추가해
            주세요.
          </div>
        ) : (
          <div className="ed-cmodal__body">
            {/* Left: page grid (both modes) — click a page to target it. */}
            <div className="ed-cmodal__list">
              {spreads.map((s) => (
                <div className="ed-cmodal__spread" key={s.key}>
                  {renderCell(s.left)}
                  {renderCell(s.right)}
                </div>
              ))}
            </div>

            {/* Right (매칭편집): upload audio into a pool, click to attach. */}
            {mode === "match" && (
              <div className="ed-cmodal__detail">
                <div className="ed-cmodal__detail-head">
                  <strong>음성 업로드</strong>
                  <span className="ed-cmodal__hint">
                    음성을 올린 뒤 <b>왼쪽에서 페이지를 고르고</b> 아래 음성을
                    누르면 그 페이지의 나레이션이 됩니다. 현재 페이지:{" "}
                    <b>
                      {activePage
                        ? cells.find((c) => c.id === activePage)?.label ?? "—"
                        : "없음"}
                    </b>
                  </span>
                  {savedList}
                </div>

                <input
                  ref={matchInputRef}
                  type="file"
                  accept="audio/*,.mp3"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files?.length) addToPool(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="narr-ed__drop"
                  onClick={() => matchInputRef.current?.click()}
                >
                  <Upload size={20} /> 음성 파일 올리기 (여러 개 가능)
                </button>

                <div className="narr-pool">
                  {pool.length === 0 ? (
                    <p className="ed-cmodal__hint">
                      아직 올린 음성이 없어요. 위에서 음성을 올려 주세요.
                    </p>
                  ) : (
                    pool.map((it) => {
                      const assignedCell = cells.find(
                        (c) => pageToPool[c.id] === it.id,
                      );
                      const onActive =
                        !!activePage && pageToPool[activePage] === it.id;
                      return (
                        <div
                          key={it.id}
                          className={`narr-pool__item${
                            onActive ? " is-on" : ""
                          }${assignedCell ? " is-assigned" : ""}`}
                          role="button"
                          onClick={() => assignPoolToActive(it.id)}
                          title="현재 페이지에 넣기/빼기"
                        >
                          <div className="narr-pool__top">
                            <span className="narr-pool__tag">
                              {assignedCell ? assignedCell.label : "미배정"}
                            </span>
                            <span className="narr-pool__name" title={it.name}>
                              {it.name}
                            </span>
                            <button
                              type="button"
                              className="icon-btn icon-btn--delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromPool(it.id);
                              }}
                              title="음성 삭제"
                              aria-label="삭제"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <audio
                            src={it.url}
                            controls
                            preload="none"
                            className="narr-pool__player"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Right (통편집): one audio waveform split into page segments. */}
            {mode === "whole" && (
            <div className="ed-cmodal__detail">
              <div className="ed-cmodal__detail-head">
                <strong>음성 → 구간</strong>
                <span className="ed-cmodal__hint">
                  파형을 클릭·드래그해 <b>빨간선</b>을 옮긴 뒤{" "}
                  <b>여기서 자르기</b>를 누르면 그 자리에서 잘려 구간이 만들어지고
                  1·3·5 홀수 페이지에 순서대로 매칭돼요. 잘린 구간을 누르면{" "}
                  <b>파란 테두리</b>로 선택되고, 양끝을 끌어 구간을 다시 조절할 수
                  있어요. <b>왼쪽에서 페이지를 고르고</b> 아래 구간을 누르면
                  매칭을 바꿀 수 있어요.
                </span>
                {savedList}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                  e.target.value = "";
                }}
              />

              {!fileName ? (
                <button
                  type="button"
                  className="narr-ed__drop"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={20} /> 음성 파일(MP3) 올리기
                </button>
              ) : (
                <div className="narr-ed__file">
                  <span className="narr-ed__name">🎵 {fileName}</span>
                  <button
                    type="button"
                    className="narr-ed__change"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    파일 바꾸기
                  </button>
                </div>
              )}

              <div
                ref={waveWrapRef}
                className="narr-ed__wave"
                style={{ display: fileName ? "block" : "none" }}
                title="Ctrl(⌘)+휠: 가로 확대/축소 · Alt+휠: 좌우 이동"
              >
                <div ref={containerRef} />
              </div>

              {fileName && (
                <>
                  <div className="narr-ed__controls">
                    <button
                      type="button"
                      className="narr-ed__play"
                      onClick={playPause}
                      disabled={!ready}
                      aria-label={playing ? "일시정지" : "재생"}
                    >
                      {playing ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                    <button
                      type="button"
                      className="ed-cmodal__btn ed-cmodal__btn--ghost"
                      onClick={autoSplit}
                      disabled={!ready}
                    >
                      <Wand2 size={15} /> 자동 분할
                    </button>
                    <button
                      type="button"
                      className="ed-cmodal__btn ed-cmodal__btn--ghost"
                      onClick={clearAll}
                      disabled={!ready || segs.length === 0}
                    >
                      <Scissors size={15} /> 비우기
                    </button>
                    <button
                      type="button"
                      className="ed-cmodal__btn ed-cmodal__btn--ghost"
                      onClick={cutAtCursor}
                      disabled={!ready}
                      title="빨간선(재생 위치)에서 자르고 1·3·5 홀수 페이지에 순서대로 매칭"
                    >
                      <Check size={15} /> 여기서 자르기
                    </button>
                    <button
                      type="button"
                      className="ed-cmodal__btn ed-cmodal__btn--ghost narr-ed__hist"
                      onClick={undoEdit}
                      disabled={!ready || hist.undo === 0}
                      title="실행 취소 (Ctrl/⌘+Z)"
                      aria-label="실행 취소"
                    >
                      <Undo2 size={15} />
                    </button>
                    <button
                      type="button"
                      className="ed-cmodal__btn ed-cmodal__btn--ghost narr-ed__hist"
                      onClick={redoEdit}
                      disabled={!ready || hist.redo === 0}
                      title="다시 실행 (Ctrl/⌘+Shift+Z)"
                      aria-label="다시 실행"
                    >
                      <Redo2 size={15} />
                    </button>
                  </div>

                  <div className="narr-ed__seghead">
                    <span>
                      나레이션 구간 <b>{segs.length}</b>
                    </span>
                    <span className="ed-cmodal__hint">
                      현재 페이지:{" "}
                      <b>
                        {activePage
                          ? cells.find((c) => c.id === activePage)?.label ?? "—"
                          : "없음"}
                      </b>
                    </span>
                  </div>
                  <div className="narr-ed__list">
                    {segs.length === 0 ? (
                      <p className="ed-cmodal__hint">
                        <b>자동 분할</b>이나 <b>여기서 자르기</b>로 구간을
                        만들어 주세요.
                      </p>
                    ) : (
                      segs.map((s, i) => {
                        const assignedId = segToPage[s.id];
                        const assigned = assignedId
                          ? cells.find((c) => c.id === assignedId)
                          : null;
                        const onActive = assignedId === activePage;
                        const picked = s.id === selectedSegId;
                        return (
                          <div
                            key={s.id}
                            className={`narr-ed__seg narr-ed__seg--pick${
                              onActive ? " is-on" : ""
                            }${picked ? " is-picked" : ""}`}
                            role="button"
                            onClick={() => {
                              setSelectedSegId(s.id);
                              toggleSegAssign(s.id);
                            }}
                            title="현재 페이지에 넣기/빼기"
                          >
                            <span className="narr-ed__seg-no">
                              {assigned ? assigned.label : `구간 ${i + 1}`}
                            </span>
                            <span className="narr-ed__seg-time">
                              {fmt(s.start)} ~ {fmt(s.end)}
                            </span>
                            <button
                              type="button"
                              className="icon-btn icon-btn--edit"
                              onClick={(e) => {
                                e.stopPropagation();
                                playSeg(s.id);
                              }}
                              title="이 구간 듣기"
                              aria-label="듣기"
                            >
                              <Play size={14} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn--delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSeg(s.id);
                              }}
                              title="구간 삭제"
                              aria-label="삭제"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
            )}
          </div>
        )}

        <div className="ed-cmodal__foot">
          {mode === "match" ? (
            <>
              <span className="ed-cmodal__count">
                올린 음성 {pool.length}개 · 매칭됨{" "}
                {Object.keys(pageToPool).length}쪽
              </span>
              <button
                type="button"
                className="ed-cmodal__btn ed-cmodal__btn--ghost"
                onClick={onClose}
                disabled={saving}
              >
                취소
              </button>
              <button
                type="button"
                className="ed-cmodal__btn ed-cmodal__btn--primary"
                onClick={() => void applyMatch()}
                disabled={saving || Object.keys(pageToPool).length === 0}
              >
                {progress
                  ? `저장 중 ${progress.cur}/${progress.total}…`
                  : "페이지에 넣기"}
              </button>
            </>
          ) : (
            <>
              <span className="ed-cmodal__count">
                구간 {segs.length}개 · 배정 {filledPages.length}쪽
              </span>
              <button
                type="button"
                className="ed-cmodal__btn ed-cmodal__btn--ghost"
                onClick={onClose}
                disabled={!!progress}
              >
                취소
              </button>
              <button
                type="button"
                className="ed-cmodal__btn ed-cmodal__btn--primary"
                onClick={() => void apply()}
                disabled={!ready || filledPages.length === 0 || !!progress}
              >
                {progress
                  ? `인코딩 중 ${progress.cur}/${progress.total}…`
                  : "페이지에 넣기"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
