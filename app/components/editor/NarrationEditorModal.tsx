"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Scissors, Trash2, Upload, Wand2, X } from "lucide-react";
import {
  detectSpeechRegions,
  encodeSlicesToMp3,
} from "../../lib/narration-audio";
import { uploadNarration } from "../../lib/store";
import { orderedCells, type SpreadRow } from "./ContentTextModal";

type Props = {
  bookId: string;
  /** Same page-grid the 내용추가 modal uses (content pages, cover excluded). */
  spreads: SpreadRow[];
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
  onClose,
  onApplied,
}: Props) {
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

  // Segments owned by a page, in time order (segs is already sorted by start).
  const segsForPage = (pageId: string) =>
    segs.filter((s) => segToPage[s.id] === pageId);
  const filledPages = cells.filter((c) => segsForPage(c.id).length > 0);

  const syncSegs = () => {
    const regs = regionsRef.current?.getRegions?.() ?? [];
    setSegs(
      regs
        .map((r: any) => ({ id: r.id, start: r.start, end: r.end }))
        .sort((a: Seg, b: Seg) => a.start - b.start),
    );
    // Drop assignments whose region no longer exists.
    const live = new Set(regs.map((r: any) => r.id));
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
      });
      const regions = ws.registerPlugin(RegionsPlugin.create());
      regions.enableDragSelection({ color: REGION_COLOR });
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
      regions.on("region-created", syncSegs);
      regions.on("region-updated", syncSegs);
      regions.on("region-removed", syncSegs);
      regions.on("region-clicked", (region: any, e: MouseEvent) => {
        e.stopPropagation();
        region.play();
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

  const playPause = () => wsRef.current?.playPause?.();

  const autoSplit = () => {
    const buf = bufferRef.current;
    const regions = regionsRef.current;
    if (!buf || !regions) return;
    regions.clearRegions();
    setSegToPage({});
    for (const r of detectSpeechRegions(buf)) {
      regions.addRegion({ start: r.start, end: r.end, color: REGION_COLOR });
    }
    syncSegs();
  };

  const clearAll = () => {
    regionsRef.current?.clearRegions?.();
    setSegToPage({});
    syncSegs();
  };

  const removeSeg = (id: string) => {
    const regs = regionsRef.current?.getRegions?.() ?? [];
    regs.find((r: any) => r.id === id)?.remove?.();
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
    setSegToPage((prev) => {
      if (prev[segId] === activePage) {
        const next = { ...prev };
        delete next[segId];
        return next;
      }
      return { ...prev, [segId]: activePage };
    });
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

  const renderCell = (cell: (typeof cells)[number] | null) => {
    if (!cell)
      return <span className="ed-cmodal__cell ed-cmodal__cell--gap" />;
    const isActive = activePage === cell.id;
    const count = segsForPage(cell.id).length;
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
          <span className="ed-cmodal__cell-pos">
            {count > 0
              ? `구간 ${count}개 🎙`
              : isActive
                ? "현재 · 구간을 누르세요"
                : "비어있음"}
          </span>
        </span>
        {count > 0 && <span className="ed-cmodal__order">{count}</span>}
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
            {/* Left: page grid — click a page to make it the target */}
            <div className="ed-cmodal__list">
              {spreads.map((s) => (
                <div className="ed-cmodal__spread" key={s.key}>
                  {renderCell(s.left)}
                  {renderCell(s.right)}
                </div>
              ))}
            </div>

            {/* Right: audio waveform + segments */}
            <div className="ed-cmodal__detail">
              <div className="ed-cmodal__detail-head">
                <strong>음성 → 구간</strong>
                <span className="ed-cmodal__hint">
                  음성을 올려 <b>자동 분할</b>하거나 파형을 드래그해 구간을
                  만드세요. <b>왼쪽에서 페이지를 먼저 고르고</b> 아래 구간을
                  누르면 그 페이지에 들어갑니다. 한 페이지에 여러 구간을 넣을 수
                  있어요.
                </span>
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
                        파형을 드래그하거나 <b>자동 분할</b>로 구간을 만들어
                        주세요.
                      </p>
                    ) : (
                      segs.map((s, i) => {
                        const assignedId = segToPage[s.id];
                        const assigned = assignedId
                          ? cells.find((c) => c.id === assignedId)
                          : null;
                        const onActive = assignedId === activePage;
                        return (
                          <div
                            key={s.id}
                            className={`narr-ed__seg narr-ed__seg--pick${
                              onActive ? " is-on" : ""
                            }`}
                            role="button"
                            onClick={() => toggleSegAssign(s.id)}
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
          </div>
        )}

        <div className="ed-cmodal__foot">
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
        </div>
      </div>
    </div>
  );
}
