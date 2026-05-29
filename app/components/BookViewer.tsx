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
import { ArrowLeft } from "lucide-react";
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
};

export default function BookViewer({ pages, onClose, singlePage }: Props) {
  const first = pages[0];
  const aspect = first ? first.width / first.height : 0.7;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<FlipBookInstance | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

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
      const isPortrait = availW < 768;
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
          aria-label="다른 책 보기"
        >
          <ArrowLeft size={14} /> 다른 책
        </button>
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
            >
              {pageEls}
            </HTMLFlipBook>
          </Suspense>
        )}
      </div>
    </div>
  );
}
