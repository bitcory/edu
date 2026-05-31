"use client";

import {
  forwardRef,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowLeft, Music, Pause, Play, VolumeX } from "lucide-react";
import type { RenderedPage } from "../lib/pdf-to-images";

type FlipBookInstance = {
  pageFlip: () => {
    flipNext: (corner?: "top" | "bottom") => void;
    flipPrev: (corner?: "top" | "bottom") => void;
  };
};

// react-pageflip touches the DOM, so it's loaded lazily — it only renders once
// `dims` is set (a client effect), so the import never runs during SSR. Using
// React.lazy (not next/dynamic) so the ref reaches the underlying component,
// which we need to drive keyboard page-flipping.
const HTMLFlipBook = lazy(() =>
  import("react-pageflip").then((m) => ({
    default: (m as unknown as { default: React.ComponentType<FlipBookProps> })
      .default,
  })),
) as unknown as React.ForwardRefExoticComponent<
  FlipBookProps & React.RefAttributes<FlipBookInstance>
>;

type FlipBookProps = {
  width: number;
  height: number;
  size?: "fixed" | "stretch";
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  showCover?: boolean;
  usePortrait?: boolean;
  mobileScrollSupport?: boolean;
  maxShadowOpacity?: number;
  drawShadow?: boolean;
  flippingTime?: number;
  startPage?: number;
  startZIndex?: number;
  autoSize?: boolean;
  clickEventForward?: boolean;
  useMouseEvents?: boolean;
  swipeDistance?: number;
  showPageCorners?: boolean;
  disableFlipByClick?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onFlip?: (e: { data: number }) => void;
};

type PageProps = {
  src: string;
  alt: string;
  isCover?: boolean;
};

const Page = forwardRef<HTMLDivElement, PageProps>(function Page(
  { src, alt, isCover },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`bv-page${isCover ? " bv-page--cover" : ""}`}
      data-density={isCover ? "hard" : "soft"}
    >
      <img src={src} alt={alt} draggable={false} />
    </div>
  );
});

type Props = {
  pages: RenderedPage[];
  onClose?: () => void;
  /** 단면: always show one page at a time (no 2-up spread). */
  singlePage?: boolean;
  /** Background music to play softly while reading. */
  audioUrl?: string;
};

export default function BookViewer({
  pages,
  onClose,
  singlePage,
  audioUrl,
}: Props) {
  const first = pages[0];
  const aspect = first ? first.width / first.height : 0.7;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<FlipBookInstance | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [musicOn, setMusicOn] = useState(false);
  // Music starts when the reader turns the front cover into the first page —
  // not on open. This ref guards that auto-start to fire only once.
  const musicStartedRef = useRef(false);

  // Prime the volume (but don't autoplay — see onFlip below).
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioUrl) return;
    el.volume = 0.3;
  }, [audioUrl]);

  // Start the background music the first time the reader leaves the cover
  // (page index ≥ 1). The flip is a user gesture, so autoplay isn't blocked.
  const startMusicOnce = () => {
    const el = audioRef.current;
    if (!el || musicStartedRef.current) return;
    musicStartedRef.current = true;
    el.volume = 0.3;
    void el.play().then(
      () => setMusicOn(true),
      () => setMusicOn(false),
    );
  };

  // ---- 자동보기: turn pages by itself every N seconds ----
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoSeconds, setAutoSeconds] = useState(5);
  const [autoPlaying, setAutoPlaying] = useState(false);
  // Current page index (kept via onFlip) so auto-play knows when to stop.
  const currentPageRef = useRef(0);
  // Page index seen at the previous tick — if it didn't change, we've hit the
  // end (flipNext is a no-op there) and auto-play stops.
  const lastTickPageRef = useRef(-1);

  const startAuto = (seconds: number) => {
    const s = Math.min(60, Math.max(1, Math.round(seconds) || 5));
    setAutoSeconds(s);
    lastTickPageRef.current = -1;
    setAutoOpen(false);
    setAutoPlaying(true);
  };

  useEffect(() => {
    if (!autoPlaying) return;
    const id = window.setInterval(() => {
      const api = bookRef.current?.pageFlip?.();
      if (!api) return;
      const cur = currentPageRef.current;
      // No progress since last tick → reached the last page, stop.
      if (cur === lastTickPageRef.current) {
        setAutoPlaying(false);
        return;
      }
      lastTickPageRef.current = cur;
      api.flipNext();
    }, autoSeconds * 1000);
    return () => window.clearInterval(id);
  }, [autoPlaying, autoSeconds]);

  const toggleMusic = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.volume = 0.3;
      void el.play().then(
        () => setMusicOn(true),
        () => setMusicOn(false),
      );
    } else {
      el.pause();
      setMusicOn(false);
    }
  };

  // Keyboard paging: → / Space = next, ← = previous.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const api = bookRef.current?.pageFlip?.();
      if (!api) return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      const onControl = ["input", "textarea", "select", "button", "a"].includes(
        tag,
      );
      if (e.key === "ArrowRight") {
        e.preventDefault();
        api.flipNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        api.flipPrev();
      } else if (e.key === " " || e.key === "Spacebar") {
        // Don't hijack Space while a button/link/field is focused.
        if (onControl) return;
        e.preventDefault();
        api.flipNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const compute = () => {
      const availW = el.clientWidth;
      const availH = el.clientHeight;
      if (availW <= 0 || availH <= 0) return;
      // Matches the CSS breakpoint (720px) so the 1-up/full-width layout and
      // the bottom-pill back button switch over at the same width.
      const isPortrait = availW < 720;
      // Spread = 2 pages wide on landscape, 1 page wide on portrait. 단면
      // books (singlePage) are always 1-up.
      const pagesAcross = singlePage || isPortrait ? 1 : 2;
      const maxPageWByWidth = availW / pagesAcross;
      const maxPageWByHeight = availH * aspect;
      const pageW = Math.floor(Math.min(maxPageWByWidth, maxPageWByHeight));
      const pageH = Math.floor(pageW / aspect);
      setDims({ w: pageW, h: pageH });
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener("orientationchange", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", compute);
    };
  }, [aspect, singlePage]);

  const pageEls = useMemo(
    () =>
      pages.map((p, i) => (
        <Page
          key={p.url}
          src={p.url}
          alt={`page ${i + 1}`}
          isCover={i === 0 || i === pages.length - 1}
        />
      )),
    [pages],
  );

  return (
    <div className="bv-shell">
      <div className="bv-desk-light" aria-hidden />
      <div className="bv-desk-grain" aria-hidden />
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="bv-close"
          aria-label="새 책 보기"
          title="새 책 보기"
        >
          <img
            className="bv-close__art"
            src="/view-close-book.png"
            alt=""
            aria-hidden="true"
          />
          <ArrowLeft size={30} />
          <span>새 책 보기</span>
        </button>
      )}
      <button
        type="button"
        className={`bv-auto${autoPlaying ? " is-on" : ""}`}
        onClick={() => (autoPlaying ? setAutoPlaying(false) : setAutoOpen(true))}
        aria-label={autoPlaying ? "자동보기 정지" : "자동보기"}
        title={autoPlaying ? "자동보기 정지" : "자동보기"}
      >
        {autoPlaying ? <Pause size={26} /> : <Play size={26} />}
        <span>{autoPlaying ? "정지" : "자동보기"}</span>
      </button>
      {autoOpen && (
        <AutoPlayModal
          initial={autoSeconds}
          onStart={startAuto}
          onClose={() => setAutoOpen(false)}
        />
      )}
      {audioUrl && (
        <>
          <audio ref={audioRef} src={audioUrl} loop preload="auto" />
          <button
            type="button"
            className={`bv-music${musicOn ? " is-on" : ""}`}
            onClick={toggleMusic}
            aria-label={musicOn ? "음악 끄기" : "음악 켜기"}
            title={musicOn ? "음악 끄기" : "음악 켜기"}
          >
            {musicOn ? <Music size={22} /> : <VolumeX size={22} />}
          </button>
        </>
      )}
      <div ref={containerRef} className="bv-stage">
        <div className="bv-book-shadow" aria-hidden />
        {dims && pages.length > 0 && (
          <Suspense fallback={null}>
            <HTMLFlipBook
              ref={bookRef}
              width={dims.w}
              height={dims.h}
              size="fixed"
              showCover
              mobileScrollSupport={false}
              maxShadowOpacity={0.4}
              drawShadow
              flippingTime={650}
              useMouseEvents
              usePortrait
              className="bv-flipbook"
              style={{}}
              onFlip={(e) => {
                currentPageRef.current = e.data;
                // Leaving the front cover (page ≥ 1) starts the music.
                if (e.data >= 1) startMusicOnce();
              }}
            >
              {pageEls}
            </HTMLFlipBook>
          </Suspense>
        )}
      </div>
    </div>
  );
}

/** Small popup to set the auto-advance interval (seconds) before starting. */
function AutoPlayModal({
  initial,
  onStart,
  onClose,
}: {
  initial: number;
  onStart: (seconds: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(String(initial));
  const seconds = Math.min(60, Math.max(1, Math.round(Number(value) || 5)));

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card modal-card--narrow" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">자동보기</h2>
        <p className="modal-hint" style={{ marginTop: 0 }}>
          설정한 시간마다 책장이 저절로 넘어가요.
        </p>
        <label className="modal-field">
          <span className="modal-label">넘김 간격 (초)</span>
          <input
            className="modal-input"
            type="number"
            min={1}
            max={60}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <span className="modal-hint">1~60초 · 기본 5초</span>
        </label>
        <div className="modal-actions">
          <button
            type="button"
            className="modal-btn modal-btn--ghost"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className="modal-btn modal-btn--primary"
            onClick={() => onStart(seconds)}
          >
            <Play size={16} /> 시작
          </button>
        </div>
      </div>
    </div>
  );
}
