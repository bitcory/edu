"use client";

import {
  forwardRef,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { BookOpen, Gauge, Music, Play, VolumeX } from "lucide-react";
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

// 웹툰 자동스크롤 속도 단계 (최대 px/sec; 나레이션이 길면 그보다 더 느려짐).
const WEBTOON_SPEEDS = [
  { label: "느림", pxps: 40 },
  { label: "보통", pxps: 60 },
  { label: "빠름", pxps: 92 },
];
const WEBTOON_SPEED_DEFAULT = 1; // 보통

type PageProps = {
  src: string;
  alt: string;
  isCover?: boolean;
  /** Rigid (hardcover) flip. Off by default so the page curls like paper. */
  hard?: boolean;
};

const Page = forwardRef<HTMLDivElement, PageProps>(function Page(
  { src, alt, isCover, hard },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`bv-page${isCover ? " bv-page--cover" : ""}`}
      data-density={hard ? "hard" : "soft"}
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
  /** 웹툰: vertical scroll of full-width images instead of a flipbook. */
  webtoon?: boolean;
  /** Background music to play softly while reading. */
  audioUrl?: string;
  /** Per-page narration URLs (aligned to page index; null where none). */
  narrationUrls?: (string | null)[];
};

export default function BookViewer({
  pages,
  onClose,
  singlePage,
  webtoon,
  audioUrl,
  narrationUrls,
}: Props) {
  const first = pages[0];
  const aspect = first ? first.width / first.height : 0.7;

  const hasNarration = !!narrationUrls?.some(Boolean);
  // Music sits a touch lower (constant — no ducking) when narration is present,
  // so the voice stays clearly on top.
  const MUSIC_VOL = hasNarration ? 0.18 : 0.3;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<FlipBookInstance | null>(null);
  // 웹툰: scroll container + per-panel refs for the visible-page observer.
  const webtoonRootRef = useRef<HTMLDivElement | null>(null);
  const panelRefs = useRef<(HTMLImageElement | null)[]>([]);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  // 웹툰 column width (px). Bigger default on desktop; Ctrl+wheel zooms it.
  const [webtoonW, setWebtoonW] = useState(680);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const narrationRef = useRef<HTMLAudioElement | null>(null);
  const [musicOn, setMusicOn] = useState(false);
  // Music starts when the reader turns the front cover into the first page —
  // not on open. This ref guards that auto-start to fire only once.
  const musicStartedRef = useRef(false);

  // Prime the volume (but don't autoplay — see onFlip below).
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioUrl) return;
    el.volume = MUSIC_VOL;
  }, [audioUrl, MUSIC_VOL]);

  // Start the background music the first time the reader leaves the cover
  // (page index ≥ 1). The flip is a user gesture, so autoplay isn't blocked.
  const startMusicOnce = () => {
    const el = audioRef.current;
    if (!el || musicStartedRef.current) return;
    musicStartedRef.current = true;
    el.volume = MUSIC_VOL;
    void el.play().then(
      () => setMusicOn(true),
      () => setMusicOn(false),
    );
  };

  // Fade the music out and stop it — called when the reader reaches the very
  // last page (the book is over), so the loop doesn't keep playing forever.
  const musicFadeRef = useRef<number | null>(null);
  const stopMusic = () => {
    const el = audioRef.current;
    if (!el || el.paused) return;
    if (musicFadeRef.current !== null) return; // already fading
    const startVol = el.volume || MUSIC_VOL;
    const steps = 24;
    let n = 0;
    musicFadeRef.current = window.setInterval(() => {
      n += 1;
      el.volume = Math.max(0, startVol * (1 - n / steps));
      if (n >= steps) {
        if (musicFadeRef.current !== null) {
          window.clearInterval(musicFadeRef.current);
          musicFadeRef.current = null;
        }
        el.pause();
        el.currentTime = 0;
        el.volume = startVol; // restore for a later manual re-play
        setMusicOn(false);
      }
    }, 70);
  };

  // ---- Per-page narration ----
  // Flipbook pacing: hold the voice for a beat after the page settles, and
  // linger on the page for a moment after the voice ends before turning.
  const NARRATION_START_DELAY_MS = 1500;
  const ADVANCE_AFTER_NARRATION_MS = 2500;
  const narrationDelayRef = useRef<number | null>(null);
  const clearNarrationDelay = () => {
    if (narrationDelayRef.current !== null) {
      window.clearTimeout(narrationDelayRef.current);
      narrationDelayRef.current = null;
    }
  };
  useEffect(() => clearNarrationDelay, []);

  // Play (or stop) the narration for a given page index.
  const playNarrationForPage = (i: number) => {
    const el = narrationRef.current;
    if (!el) return;
    const url = narrationUrls?.[i] ?? null;
    if (url) {
      if (el.src !== url) el.src = url;
      el.currentTime = 0;
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  // ---- 자동보기: turn pages by itself ----
  // With narration: advance when the voice ends. Without: after N seconds.
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoSeconds, setAutoSeconds] = useState(5);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const autoPlayingRef = useRef(false);
  const currentPageRef = useRef(0);
  const autoTimerRef = useRef<number | null>(null);
  // True while we're holding for the current page's narration to finish.
  const waitingForNarrationRef = useRef(false);
  // 웹툰 자동스크롤: rAF handle + the panel currently being scrolled through.
  const autoRafRef = useRef<number | null>(null);
  const autoSegRef = useRef<{
    fromTop: number;
    toTop: number;
    durationMs: number;
    startTs: number;
    idx: number;
  } | null>(null);
  // Min seconds to spend on a panel that has no narration of its own.
  const WEBTOON_SILENT_SECS = 4;
  // User-chosen cap on auto-scroll speed (CSS px / sec). If a panel's narration
  // is short relative to its height, syncing to the voice would scroll too fast,
  // so we stretch the travel time to keep speed at or below this. The ref mirrors
  // the state so the rAF/segment logic reads the latest value synchronously.
  const [webtoonSpeedIdx, setWebtoonSpeedIdx] = useState(WEBTOON_SPEED_DEFAULT);
  const webtoonSpeedRef = useRef(WEBTOON_SPEEDS[WEBTOON_SPEED_DEFAULT].pxps);

  const clearAutoTimer = () => {
    if (autoTimerRef.current !== null) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    waitingForNarrationRef.current = false;
  };

  const stopAutoScroll = () => {
    if (autoRafRef.current !== null) {
      cancelAnimationFrame(autoRafRef.current);
      autoRafRef.current = null;
    }
    autoSegRef.current = null;
  };

  // Move to the next page; stop auto-play at the end (flipbook).
  const advance = () => {
    if (currentPageRef.current >= pages.length - 1) {
      setAutoPlaying(false);
      return;
    }
    bookRef.current?.pageFlip?.().flipNext();
  };

  // ---- 웹툰 자동스크롤 (나레이션에 맞춘 연속 스크롤) ----
  // The scroll never stops on its own: each frame advances scrollTop toward the
  // next panel's top. The DURATION of that travel = the current panel's
  // narration length, so we glide through a panel exactly while its voice plays
  // (motion-comic style). Audio and scroll are independent, so the scroll keeps
  // working even if a narration clip is blocked or missing.
  const tickAutoScroll = (ts: number) => {
    if (!autoPlayingRef.current) {
      autoRafRef.current = null;
      return;
    }
    const root = webtoonRootRef.current;
    const seg = autoSegRef.current;
    if (!root || !seg) {
      autoRafRef.current = null;
      return;
    }
    if (!seg.startTs) seg.startTs = ts;
    const t = Math.min(1, (ts - seg.startTs) / seg.durationMs);
    root.scrollTop = seg.fromTop + (seg.toTop - seg.fromTop) * t;
    if (t >= 1) {
      autoRafRef.current = null;
      if (seg.idx >= pages.length - 1) {
        setAutoPlaying(false);
        return;
      }
      beginWebtoonPanel(seg.idx + 1);
      return;
    }
    autoRafRef.current = requestAnimationFrame(tickAutoScroll);
  };

  // Start playing panel `idx`'s narration and set up the scroll segment that
  // glides through it for the narration's duration.
  const beginWebtoonPanel = (i: number) => {
    if (!autoPlayingRef.current) return;
    const root = webtoonRootRef.current;
    if (!root) return;
    const last = pages.length - 1;
    const idx = Math.max(0, Math.min(last, i));
    currentPageRef.current = idx;
    if (idx >= 1) startMusicOnce();
    playNarrationForPage(idx);

    const panels = panelRefs.current;
    const fromTop = root.scrollTop;
    const toTop =
      idx >= last
        ? Math.max(0, root.scrollHeight - root.clientHeight)
        : panels[idx + 1]?.offsetTop ?? fromTop;

    const begin = (durationMs: number) => {
      // Don't let the travel be faster than the chosen max speed.
      const distance = Math.abs(toTop - fromTop);
      const minMsForSpeed = (distance / webtoonSpeedRef.current) * 1000;
      autoSegRef.current = {
        fromTop,
        toTop,
        durationMs: Math.max(800, durationMs, minMsForSpeed),
        startTs: 0,
        idx,
      };
      if (autoRafRef.current === null) {
        autoRafRef.current = requestAnimationFrame(tickAutoScroll);
      }
    };

    const el = narrationRef.current;
    if (narrationUrls?.[idx] && el) {
      // Glide for the narration's real length once metadata gives us duration.
      const usable = () => Number.isFinite(el.duration) && el.duration > 0;
      if (usable()) {
        begin(el.duration * 1000);
      } else {
        const onMeta = () => begin(usable() ? el.duration * 1000 : WEBTOON_SILENT_SECS * 1000);
        el.addEventListener("loadedmetadata", onMeta, { once: true });
        // Safety net if metadata never arrives.
        window.setTimeout(() => {
          if (autoSegRef.current?.idx !== idx) onMeta();
        }, 1200);
      }
    } else {
      begin(WEBTOON_SILENT_SECS * 1000);
    }
  };

  // Decide when to advance from the page we're currently on (flipbook).
  const scheduleAdvance = () => {
    clearAutoTimer();
    if (!autoPlayingRef.current) return;
    const i = currentPageRef.current;
    if (narrationUrls?.[i]) {
      // This page has narration → advance when the voice 'ended' fires.
      waitingForNarrationRef.current = true;
    } else {
      autoTimerRef.current = window.setTimeout(advance, autoSeconds * 1000);
    }
  };

  const onNarrationEnded = () => {
    // Flipbook only — webtoon advances on scroll-segment completion, not here.
    if (webtoon) return;
    if (autoPlayingRef.current && waitingForNarrationRef.current) {
      waitingForNarrationRef.current = false;
      autoTimerRef.current = window.setTimeout(
        advance,
        ADVANCE_AFTER_NARRATION_MS,
      );
    }
  };

  // If a page's narration fails to load/play in flipbook auto mode, don't get
  // stuck — fall back to the timed advance.
  const onNarrationError = () => {
    if (webtoon) return;
    if (autoPlayingRef.current && waitingForNarrationRef.current) {
      waitingForNarrationRef.current = false;
      autoTimerRef.current = window.setTimeout(advance, autoSeconds * 1000);
    }
  };

  useEffect(() => {
    autoPlayingRef.current = autoPlaying;
    if (autoPlaying) {
      // Start here (NOT in the click handler): this effect runs once when
      // autoPlaying flips true and owns the rAF/timer, so a re-render can't tear
      // it down. The click handler only primes audio inside the user gesture.
      if (webtoon) beginWebtoonPanel(currentPageRef.current);
      else scheduleAdvance();
    } else {
      clearAutoTimer();
      stopAutoScroll();
    }
    return () => {
      clearAutoTimer();
      stopAutoScroll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlaying, autoSeconds, webtoon]);

  const startAuto = (seconds: number) => {
    const s = Math.min(60, Math.max(1, Math.round(seconds) || 5));
    setAutoSeconds(s);
    setAutoOpen(false);
    // Start the music NOW — this runs inside the modal's "시작" click, a real
    // user gesture, so the browser's autoplay policy lets it play. (The later
    // auto-advance happens from a timer, which can't unlock audio on its own.)
    startMusicOnce();
    // Open the first page right away instead of sitting on the cover for one
    // interval. If we're already past the cover, auto-play continues from here.
    if (currentPageRef.current < 1) {
      bookRef.current?.pageFlip?.().flipNext();
    }
    setAutoPlaying(true);
  };

  // 웹툰 모드: 자동보기 버튼은 모달 없이 바로 나레이션-페이스 자동스크롤을 토글한다.
  const toggleWebtoonAuto = () => {
    if (autoPlaying) {
      setAutoPlaying(false);
      narrationRef.current?.pause();
      return;
    }
    // Prime audio inside THIS click (a user gesture) so the browser's autoplay
    // policy doesn't block it: start the music and the current panel's narration
    // now. The effect (triggered by setAutoPlaying) then drives the scroll.
    startMusicOnce();
    playNarrationForPage(currentPageRef.current);
    setAutoPlaying(true);
  };

  // Cycle 느림 → 보통 → 빠름. Applies to upcoming panels and re-paces the panel
  // currently in motion so the change is felt immediately.
  const cycleWebtoonSpeed = () => {
    const next = (webtoonSpeedIdx + 1) % WEBTOON_SPEEDS.length;
    setWebtoonSpeedIdx(next);
    webtoonSpeedRef.current = WEBTOON_SPEEDS[next].pxps;
    const root = webtoonRootRef.current;
    const seg = autoSegRef.current;
    if (root && seg) {
      const dist = Math.abs(seg.toTop - root.scrollTop);
      seg.fromTop = root.scrollTop;
      seg.durationMs = Math.max(300, (dist / webtoonSpeedRef.current) * 1000);
      seg.startTs = 0;
    }
  };

  // A genuine wheel/touch on the webtoon unlocks music AND stops auto-scroll
  // (so the reader can take over), mirroring how webtoon viewers pause on
  // manual scroll. Ctrl/⌘+wheel is a zoom gesture, so leave auto-scroll alone.
  const onWebtoonManualScroll = (
    e: React.WheelEvent | React.TouchEvent,
  ) => {
    startMusicOnce();
    const isZoom = "ctrlKey" in e && (e.ctrlKey || e.metaKey);
    if (autoPlayingRef.current && !isZoom) setAutoPlaying(false);
  };

  const toggleMusic = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.volume = MUSIC_VOL;
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

  // Tap-to-flip (mobile + desktop). The library's own click-flip is disabled
  // because it's unreliable on touch, so we detect a genuine tap — press then
  // release with little movement — and flip toward the side that was tapped.
  // A swipe (movement past the threshold) is left to the flipbook's drag.
  const tapStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const onStagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    tapStartRef.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
  };
  const onStagePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = tapStartRef.current;
    tapStartRef.current = null;
    if (!s) return;
    // Moved too far → a swipe/drag, not a tap. Let the flipbook handle it.
    if (Math.abs(e.clientX - s.x) > 12 || Math.abs(e.clientY - s.y) > 12) return;
    if (e.timeStamp - s.t > 500) return; // long press, not a tap
    const api = bookRef.current?.pageFlip?.();
    if (!api) return;
    const rect = containerRef.current?.getBoundingClientRect();
    const mid = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    // Tap the right half → next page, left half → previous.
    if (e.clientX >= mid) api.flipNext();
    else api.flipPrev();
  };

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

  // 웹툰: drive narration/music from scroll. An IntersectionObserver with a
  // center band (rootMargin -50%/-50%) reports the single panel crossing the
  // viewport's vertical middle as the "current page" — the scroll equivalent of
  // the flipbook's onFlip. Music start needs a user gesture, so the scroll
  // handlers on the container also kick it off (the ref-guard makes both safe).
  useEffect(() => {
    if (!webtoon) return;
    const root = webtoonRootRef.current;
    if (!root) return;
    const els = panelRefs.current.filter(Boolean) as HTMLImageElement[];
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        // During auto-scroll the explicit stepping drives narration; ignore the
        // observer so it doesn't double-trigger or fight the programmatic scroll.
        if (autoPlayingRef.current) return;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.index);
          if (Number.isNaN(i) || i === currentPageRef.current) continue;
          currentPageRef.current = i;
          if (i >= 1) startMusicOnce();
          if (i === 0 || i >= pages.length - 1) stopMusic();
          playNarrationForPage(i);
        }
      },
      { root, rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webtoon, pages.length]);

  // 웹툰: Ctrl/⌘ + wheel zooms the column width. A native listener with
  // { passive: false } is required — React's onWheel can't preventDefault the
  // browser's own ctrl+wheel page zoom.
  useEffect(() => {
    if (!webtoon) return;
    const root = webtoonRootRef.current;
    if (!root) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setWebtoonW((w) =>
        Math.round(Math.min(1200, Math.max(360, w - e.deltaY))),
      );
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [webtoon]);

  const pageEls = useMemo(
    () =>
      pages.map((p, i) => (
        <Page
          key={p.url}
          src={p.url}
          alt={`page ${i + 1}`}
          isCover={i === 0 || i === pages.length - 1}
          // Front cover flips soft (paper curl) like every other page; only the
          // back cover keeps the rigid hardcover turn to "close" the book.
          hard={i === pages.length - 1}
        />
      )),
    [pages],
  );

  return (
    <div className="bv-shell">
      <div className="bv-desk-light" aria-hidden />
      <div className="bv-desk-grain" aria-hidden />
      {hasNarration && (
        <audio
          ref={narrationRef}
          preload="auto"
          onEnded={onNarrationEnded}
          onError={onNarrationError}
        />
      )}
      {audioUrl && <audio ref={audioRef} src={audioUrl} loop preload="auto" />}
      <div className="bv-controls">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="bv-ctl bv-ctl--close"
            aria-label="새 책 보기"
            title="새 책 보기"
          >
            <BookOpen size={18} aria-hidden />
            <span>새 책 보기</span>
          </button>
        )}
        {audioUrl && (
          <button
            type="button"
            className={`bv-ctl bv-ctl--icon bv-music${musicOn ? " is-on" : ""}`}
            onClick={toggleMusic}
            aria-label={musicOn ? "음악 끄기" : "음악 켜기"}
            title={musicOn ? "음악 끄기" : "음악 켜기"}
          >
            {musicOn ? <Music size={20} /> : <VolumeX size={20} />}
          </button>
        )}
        <button
          type="button"
          className={`bv-ctl bv-auto${webtoon ? " bv-auto--scroll" : ""}${autoPlaying ? " is-on" : ""}`}
          onClick={() =>
            autoPlaying
              ? setAutoPlaying(false)
              : webtoon
                ? toggleWebtoonAuto()
                : setAutoOpen(true)
          }
          aria-label={
            autoPlaying
              ? webtoon
                ? "자동스크롤 정지"
                : "자동보기 정지"
              : webtoon
                ? "자동스크롤"
                : "자동보기"
          }
          title={
            autoPlaying
              ? webtoon
                ? "자동스크롤 정지"
                : "자동보기 정지"
              : webtoon
                ? "자동스크롤"
                : "자동보기"
          }
        >
          <Play size={16} aria-hidden />
          <span>
            {autoPlaying ? "정지" : webtoon ? "자동스크롤" : "자동보기"}
          </span>
        </button>
        {webtoon && (
          <button
            type="button"
            className="bv-ctl bv-ctl--speed"
            onClick={cycleWebtoonSpeed}
            aria-label={`스크롤 속도: ${WEBTOON_SPEEDS[webtoonSpeedIdx].label} (눌러서 변경)`}
            title="스크롤 속도"
          >
            <Gauge size={16} aria-hidden />
            <span>{WEBTOON_SPEEDS[webtoonSpeedIdx].label}</span>
          </button>
        )}
      </div>
      {autoOpen && (
        <AutoPlayModal
          initial={autoSeconds}
          onStart={startAuto}
          onClose={() => setAutoOpen(false)}
        />
      )}
      {webtoon ? (
        <div
          ref={webtoonRootRef}
          className="bv-webtoon"
          onScroll={startMusicOnce}
          onWheel={onWebtoonManualScroll}
          onTouchStart={onWebtoonManualScroll}
        >
          <div
            className="bv-webtoon__strip"
            style={{ width: webtoonW, maxWidth: "100%" }}
          >
            {pages.map((p, i) => (
              <img
                key={p.url}
                ref={(el) => {
                  panelRefs.current[i] = el;
                }}
                data-index={i}
                className="bv-webtoon__img"
                src={p.url}
                alt={`page ${i + 1}`}
                draggable={false}
                decoding="async"
                loading={i < 2 ? "eager" : "lazy"}
              />
            ))}
          </div>
        </div>
      ) : (
      <div
        ref={containerRef}
        className="bv-stage"
        onPointerDownCapture={onStagePointerDown}
        onPointerUpCapture={onStagePointerUp}
      >
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
              // We drive tap-to-flip ourselves (see the stage pointer handlers)
              // so it's reliable on mobile; the library's own click-flip is off
              // to avoid a double flip. Swipe/drag still works.
              disableFlipByClick
              maxShadowOpacity={0.4}
              drawShadow
              flippingTime={1200}
              useMouseEvents
              usePortrait
              className="bv-flipbook"
              style={{}}
              onFlip={(e) => {
                currentPageRef.current = e.data;
                // Leaving the front cover (page ≥ 1) starts the music.
                if (e.data >= 1) startMusicOnce();
                // On a cover — the front cover (first page) or the back cover
                // (last page) — fade the music out, since the story isn't being
                // read there and the loop shouldn't keep playing.
                if (e.data === 0 || e.data >= pages.length - 1) stopMusic();
                // Stop the previous page's voice right away, then start this
                // page's narration after a short breath (manual or auto).
                clearNarrationDelay();
                narrationRef.current?.pause();
                if (narrationUrls?.[e.data]) {
                  narrationDelayRef.current = window.setTimeout(() => {
                    narrationDelayRef.current = null;
                    playNarrationForPage(e.data);
                  }, NARRATION_START_DELAY_MS);
                }
                // In auto mode, decide when to turn next from this page.
                if (autoPlayingRef.current) scheduleAdvance();
              }}
            >
              {pageEls}
            </HTMLFlipBook>
          </Suspense>
        )}
      </div>
      )}
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
