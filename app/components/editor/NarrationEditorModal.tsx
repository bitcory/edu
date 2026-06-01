"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  Scissors,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { detectSpeechRegions, encodeSliceToMp3 } from "../../lib/narration-audio";
import { uploadNarration } from "../../lib/store";

type Props = {
  bookId: string;
  pageCount: number; // total pages incl. cover (page 0)
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
  pageCount,
  onClose,
  onApplied,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<any>(null);
  const regionsRef = useRef<any>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const urlRef = useRef<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const fileName = file?.name ?? null;
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [segs, setSegs] = useState<Seg[]>([]);
  const [progress, setProgress] = useState<{ cur: number; total: number } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Content pages available for narration (everything after the cover).
  const contentPages = Math.max(0, pageCount - 1);

  const syncSegs = useCallback(() => {
    const regs = regionsRef.current?.getRegions?.() ?? [];
    const list: Seg[] = regs
      .map((r: any) => ({ id: r.id, start: r.start, end: r.end }))
      .sort((a: Seg, b: Seg) => a.start - b.start);
    setSegs(list);
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

  // Build the waveform once the container is visible (after `file` renders).
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
        height: 96,
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
    const found = detectSpeechRegions(buf);
    for (const r of found) {
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

  const apply = useCallback(async () => {
    const buf = bufferRef.current;
    if (!buf || segs.length === 0) return;
    const ordered = [...segs].sort((a, b) => a.start - b.start);
    setProgress({ cur: 0, total: ordered.length });
    const applied: number[] = [];
    try {
      for (let i = 0; i < ordered.length; i++) {
        const pageIndex = i + 1; // 구간1 → 1쪽 (skip cover at 0)
        const mp3 = await encodeSliceToMp3(buf, ordered[i].start, ordered[i].end);
        const file = new File([mp3 as BlobPart], `${pageIndex}.mp3`, {
          type: "audio/mpeg",
        });
        await uploadNarration(bookId, pageIndex, file);
        applied.push(pageIndex);
        setProgress({ cur: i + 1, total: ordered.length });
        // Let the UI repaint between (sync) encodes.
        await new Promise((r) => setTimeout(r, 0));
      }
      onApplied(applied);
      alert(
        `${applied.length}개 구간을 1쪽부터 ${applied.length}쪽까지 나레이션으로 넣었어요!`,
      );
      onClose();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setProgress(null);
    }
  }, [bookId, segs, onApplied, onClose]);

  const overflow = segs.length > contentPages;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="modal-card narr-ed"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bgm-head">
          <h2 className="modal-title">🎙 나레이션 편집</h2>
          <button type="button" className="cp-close" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <p className="modal-hint" style={{ marginTop: 0 }}>
          음성 한 파일을 올리고 구간을 나누면, <b>1쪽부터 차례대로</b> 페이지
          나레이션으로 잘려 들어가요. (파형을 드래그해 구간을 만들거나 <b>자동 분할</b>)
        </p>

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
            <Upload size={22} /> 음성 파일(MP3) 올리기
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

        {/* Waveform (always mounted so the ref exists for wavesurfer). */}
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
                className="modal-btn modal-btn--ghost"
                onClick={autoSplit}
                disabled={!ready}
              >
                <Wand2 size={15} /> 자동 분할
              </button>
              <button
                type="button"
                className="modal-btn modal-btn--ghost"
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
              {overflow && (
                <span className="narr-ed__warn">
                  내용 페이지({contentPages}쪽)보다 구간이 많아요 — 넘는 건 안
                  들어가요
                </span>
              )}
            </div>

            <div className="narr-ed__list">
              {segs.length === 0 ? (
                <p className="modal-hint">
                  파형을 드래그하거나 <b>자동 분할</b>로 구간을 만들어 주세요.
                </p>
              ) : (
                segs.map((s, i) => {
                  const page = i + 1;
                  const over = page > contentPages;
                  return (
                    <div
                      key={s.id}
                      className={`narr-ed__seg${over ? " is-over" : ""}`}
                    >
                      <span className="narr-ed__seg-no">
                        {over ? "—" : `${page}쪽`}
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

            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn modal-btn--ghost"
                onClick={onClose}
                disabled={!!progress}
              >
                닫기
              </button>
              <button
                type="button"
                className="modal-btn modal-btn--primary"
                onClick={() => void apply()}
                disabled={!ready || segs.length === 0 || !!progress}
              >
                {progress
                  ? `인코딩 중 ${progress.cur}/${progress.total}…`
                  : "페이지에 넣기"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
