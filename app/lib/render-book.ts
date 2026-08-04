"use client";

import { pagesPngToPdf, pdfBytesToBlobUrl, pdfBytesToFile } from "./book-to-pdf";
import { PAGE_H, PAGE_W, type EditorPage } from "./editor-types";
import {
  renderPdfToImages,
  revokePages,
  type RenderedPage,
} from "./pdf-to-images";
import type { StoreBook } from "./book-types";
import { getBook } from "./store";
import { ensureFont } from "./fonts";

/** Load every font used across the pages (both normal + bold) before drawing,
 * so the offscreen canvas doesn't render text in a fallback font. */
async function ensurePageFonts(pages: EditorPage[]): Promise<void> {
  const families = new Set<string>();
  for (const p of pages) {
    const objects = (
      p.data as { objects?: Array<Record<string, unknown>> } | undefined
    )?.objects;
    if (!objects) continue;
    for (const o of objects) {
      if (typeof o.fontFamily === "string") families.add(o.fontFamily);
    }
  }
  await Promise.all(
    [...families].flatMap((f) => [ensureFont(f, 400), ensureFont(f, 700)]),
  );
}

export type RenderedBook = {
  rendered: RenderedPage[];
  pdfBytes: Uint8Array;
  pdfUrl: string;
};

/**
 * Render a Fabric snapshot (EditorPage[]) into flip-book images + a PDF.
 * Each page's serialized state is drawn on an offscreen StaticCanvas, exported
 * to PNG, bundled into a PDF, then re-rendered to images for BookViewer.
 * Shared by the editor preview and the bookstore reader.
 */
export async function renderSnapshotToImages(
  pages: EditorPage[],
  fileName = "book.pdf",
  pageW: number = PAGE_W,
  pngMultiplier = 1,
): Promise<RenderedBook> {
  const fabric = await import("fabric");
  await ensurePageFonts(pages);
  const offEl = document.createElement("canvas");
  offEl.width = pageW;
  offEl.height = PAGE_H;
  const off = new fabric.StaticCanvas(offEl, {
    width: pageW,
    height: PAGE_H,
    backgroundColor: "#ffffff",
  });
  const pngs: string[] = [];
  for (const page of pages) {
    if (page.data) {
      await off.loadFromJSON(page.data);
      off.renderAll();
    } else {
      off.clear();
      off.backgroundColor = "#ffffff";
      off.renderAll();
    }
    pngs.push(off.toDataURL({ format: "png", multiplier: pngMultiplier }));
  }
  off.dispose();

  const pdfBytes = await pagesPngToPdf(pngs, pageW);
  const pdfUrl = pdfBytesToBlobUrl(pdfBytes);
  const file = await pdfBytesToFile(pdfBytes, fileName);
  const rendered = await renderPdfToImages(file);

  return { rendered, pdfBytes, pdfUrl };
}

/**
 * Render a single page (the cover) to a sharp data URL for the book's cover
 * thumbnail. The editor caches page thumbs at 0.2× (≈160px) — fine for the tiny
 * page list, but blurry blown up onto a store card. This redraws the page at a
 * higher resolution (with its fonts) so the cover stays crisp, incl. on retina.
 */
export async function renderCoverThumb(
  page: EditorPage | undefined,
  pageW: number = PAGE_W,
): Promise<string | undefined> {
  if (!page?.data) return undefined;
  const fabric = await import("fabric");
  await ensurePageFonts([page]);
  const offEl = document.createElement("canvas");
  offEl.width = pageW;
  offEl.height = PAGE_H;
  const off = new fabric.StaticCanvas(offEl, {
    width: pageW,
    height: PAGE_H,
    backgroundColor: "#ffffff",
  });
  try {
    await off.loadFromJSON(page.data);
    off.renderAll();
    // 0.7× (≈560px). 목록 카드가 화면에서 250px 안팎이라 고해상도 화면에서도
    // 2배가 넘는다. 1.5×(1200px)까지 올려 봤지만 눈에 띄는 차이 없이 파일만
    // 3.5배가 됐다 — 원래 값이 맞았다.
    return off.toDataURL({ format: "jpeg", quality: 0.9, multiplier: 0.7 });
  } finally {
    off.dispose();
  }
}

/**
 * Render a Fabric snapshot straight to flip-book images for the reader —
 * Fabric → image per page, skipping the PDF + pdf.js round-trip that
 * renderSnapshotToImages does (that's only needed when we also want a
 * downloadable PDF, e.g. the editor preview). Much faster to open.
 */
export async function renderSnapshotToPages(
  pages: EditorPage[],
  pageW: number = PAGE_W,
  multiplier = 1.5,
): Promise<RenderedPage[]> {
  const fabric = await import("fabric");
  await ensurePageFonts(pages);
  const offEl = document.createElement("canvas");
  offEl.width = pageW;
  offEl.height = PAGE_H;
  const off = new fabric.StaticCanvas(offEl, {
    width: pageW,
    height: PAGE_H,
    backgroundColor: "#ffffff",
  });
  const out: RenderedPage[] = [];
  for (const page of pages) {
    if (page.data) {
      await off.loadFromJSON(page.data);
      off.renderAll();
    } else {
      off.clear();
      off.backgroundColor = "#ffffff";
      off.renderAll();
    }
    // Caller picks the multiplier (1.5× default for crisp text/lines; webtoon
    // pages are narrow — only ~563px — so they're rendered higher-res so they
    // stay sharp when enlarged/zoomed on a big screen). White bg → JPEG is fine.
    const url = off.toDataURL({ format: "jpeg", quality: 0.92, multiplier });
    out.push({
      url,
      width: Math.round(pageW * multiplier),
      height: Math.round(PAGE_H * multiplier),
    });
  }
  off.dispose();
  return out;
}

export type OpenedBook = { rendered: RenderedPage[]; revoke: () => void };

/**
 * Render a StoreBook for reading, regardless of kind:
 *  - "pdf": fetch the stored PDF and render its pages.
 *  - "editor": render the Fabric snapshot.
 * Returns the images plus a revoke() to free their object URLs on close.
 */
export async function openBookForReading(book: StoreBook): Promise<OpenedBook> {
  if (book.kind === "pdf") {
    let blob: Blob | null = null;
    // Fast path: download straight from R2 via a presigned URL (free egress).
    // Needs bucket CORS to allow GET — if that fails, fall back to the proxy.
    try {
      const u = await fetch(`/api/books/${book.id}/pdf-url`, {
        cache: "no-store",
      });
      if (u.ok) {
        const { url } = (await u.json()) as { url: string };
        const direct = await fetch(url);
        if (direct.ok) blob = await direct.blob();
      }
    } catch {
      /* fall back to the proxy below */
    }
    if (!blob) {
      const res = await fetch(`/api/books/${book.id}/pdf`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("PDF를 불러오지 못했어요.");
      blob = await res.blob();
    }
    const file = new File([blob], `${book.title}.pdf`, {
      type: "application/pdf",
    });
    const rendered = await renderPdfToImages(file);
    return { rendered, revoke: () => revokePages(rendered) };
  }
  // Editor book: render the snapshot straight to images (no PDF round-trip).
  // The store list ships books WITHOUT the heavy `pages` blob (for speed), so
  // hydrate it on open via getBook (downloads the snapshot directly from R2).
  let pages = book.pages;
  if (!pages || pages.length === 0) {
    const full = await getBook(book.id);
    if (!full) throw new Error("책 내용을 불러오지 못했어요.");
    pages = full.pages;
  }
  // Webtoon panels are narrow (9:16) — render them higher-res so they stay
  // crisp when shown larger / zoomed on desktop.
  const multiplier = book.layout === "webtoon" ? 2.2 : 1.5;
  const rendered = await renderSnapshotToPages(
    pages,
    book.pageW || PAGE_W,
    multiplier,
  );
  return { rendered, revoke: () => revokePages(rendered) };
}
