"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import type { RenderedPage } from "../lib/pdf-to-images";

// react-pageflip touches the DOM, so client-only.
const HTMLFlipBook = dynamic(() => import("react-pageflip"), {
  ssr: false,
}) as unknown as React.ComponentType<FlipBookProps>;

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
};

export default function BookViewer({ pages, onClose }: Props) {
  const first = pages[0];
  const aspect = first ? first.width / first.height : 0.7;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const compute = () => {
      const availW = el.clientWidth;
      const availH = el.clientHeight;
      if (availW <= 0 || availH <= 0) return;
      const isPortrait = availW < 768;
      // Spread = 2 pages wide on landscape, 1 page wide on portrait.
      const pagesAcross = isPortrait ? 1 : 2;
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
  }, [aspect]);

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
          <HTMLFlipBook
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
        )}
      </div>
    </div>
  );
}
