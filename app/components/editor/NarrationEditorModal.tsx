"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Scissors, Trash2, Upload, Wand2, X } from "lucide-react";
import {
  detectSpeechRegions,
  encodeSliceToMp3,
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
  // Selected page ids; application order = page order among the selected
  // (mirrors 내용추가). Default: every content page selected → 1쪽부터.
  const [selected, setSelected] = useState<string[]>(() =>
    cells.map((c) => c.id),
  );
  const [progress, setProgress] = useState<{ cur: number; total: number } | null>(
    null,
  );

  const sel = new Set(selected);
  const chosen = cells.filter((c) => sel.has(c.id)); // page order

  const syncSegs = useCallback(() => {
    const regs = regionsRef.current?.getRegions?.() ?? [];
    setSegs(
      regs
        .map((r: any) => ({ id: r.id, start: r.start, end: r.end }))
        .sort((a: Seg, b: Seg) => a.start - b.start),
    );
  }, []);

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
      setPlaying(false);

      const WaveSurfer = (await import("wavesurfer.js")).default;
      const RegionsPlugin = (
        await import("wavesurfer.js/dist/plugins/regions.esm.js")
      ).default;
      if (cancelled || !containerRef.current) return;

      const ws = WaveSurfer.create({
        container: containerRef.current,
        height: 140,
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

  const playPause = () => wsRef.current?.playPause?.();

  const autoSplit = () => {
    const buf = bufferRef.current;
    const regions = regionsRef.current;
    if (!buf || !regions) return;
    regions.clearRegions();
    for (const r of detectSpeechRegions(buf)) {
      regions.addRegion({ start: r.start, end: r.end, color: REGION_COLOR });
    }
    syncSegs();
  };

  const clearAll = () => {
    regionsRef.current?.clearRegions?.();
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

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id],
    );

  const apply = useCallback(async () => {
    const buf = bufferRef.current;
    if (!buf || segs.length === 0 || chosen.length === 0) return;
    const ordered = [...segs].sort((a, b) => a.start - b.start);
    const n = Math.min(ordered.length, chosen.length);
    setProgress({ cur: 0, total: n });
    const applied: number[] = [];
    try {
      for (let i = 0; i < n; i++) {
        const pageIndex = chosen[i].index;
        const mp3 = await encodeSliceToMp3(buf, ordered[i].start, ordered[i].end);
        const f = new File([mp3 as BlobPart], `${pageIndex}.mp3`, {
          type: "audio/mpeg",
        });
        await uploadNarration(bookId, pageIndex, f);
        applied.push(pageIndex);
        setProgress({ cur: i + 1, total: n });
        await new Promise((r) => setTimeout(r, 0));
      }
      onApplied(applied);
      alert(`${applied.length}개 구간을 선택한 페이지에 넣었어요!`);
      onClose();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setProgress(null);
    }
  }, [bookId, segs, chosen, onApplied, onClose]);

  const renderCell = (cell: (typeof cells)[number] | null) => {
    if (!cell)
      return <span className="ed-cmodal__cell ed-cmodal__cell--gap" />;
    const isSel = sel.has(cell.id);
    const order = isSel ? chosen.findIndex((c) => c.id === cell.id) + 1 : 0;
    // Does this selected slot have a segment to receive?
    const willGet = isSel && order <= segs.length;
    return (
      <button
        type="button"
        className={`ed-cmodal__cell${isSel ? " is-active" : ""}`}
        onClick={() => toggle(cell.id)}
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
            {isSel
              ? willGet
                ? `구간 ${order} 🎙`
                : "구간 부족"
              : "안 넣음"}
          </span>
        </span>
        {isSel && <span className="ed-cmodal__order">{order}</span>}
      </button>
    );
  };

  return (
    <div className="ed-cmodal-backdrop" onClick={onClose}>
      <div className="ed-cmodal" onClick={(e) => e.stopPropagation()}>
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
            {/* Left: page image grid (selection order = which segment) */}
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
                  음성 한 파일을 올리고 <b>자동 분할</b>하거나 파형을 드래그해
                  구간을 만드세요. 구간이 왼쪽에서 선택한 페이지에 순서대로
                  들어갑니다.
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
                className="narr-ed__wave"
                style={{ display: fileName ? "block" : "none" }}
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
                    나레이션 구간 <b>{segs.length}</b>
                  </div>
                  <div className="narr-ed__list">
                    {segs.length === 0 ? (
                      <p className="ed-cmodal__hint">
                        파형을 드래그하거나 <b>자동 분할</b>로 구간을 만들어
                        주세요.
                      </p>
                    ) : (
                      segs.map((s, i) => {
                        const target = chosen[i];
                        return (
                          <div key={s.id} className="narr-ed__seg">
                            <span className="narr-ed__seg-no">
                              {target ? target.label : "—"}
                            </span>
                            <span className="narr-ed__seg-time">
                              {fmt(s.start)} ~ {fmt(s.end)}
                            </span>
                            <button
                              type="button"
                              className="icon-btn icon-btn--edit"
                              onClick={() => playSeg(s.id)}
                              title="이 구간 듣기"
                              aria-label="듣기"
                            >
                              <Play size={14} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn--delete"
                              onClick={() => removeSeg(s.id)}
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
            구간 {segs.length}개 · 선택 {chosen.length}쪽
            {segs.length > 0 &&
              chosen.length > 0 &&
              segs.length !== chosen.length &&
              ` · ${Math.min(segs.length, chosen.length)}개만 적용됨`}
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
            disabled={!ready || segs.length === 0 || chosen.length === 0 || !!progress}
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
