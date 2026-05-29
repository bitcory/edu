"use client";

import { pagesPngToPdf, pdfBytesToBlobUrl, pdfBytesToFile } from "./book-to-pdf";
import { PAGE_H, PAGE_W, type EditorPage } from "./editor-types";
import {
  renderPdfToImages,
  revokePages,
  type RenderedPage,
} from "./pdf-to-images";
import type { StoreBook } from "./book-types";

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
): Promise<RenderedBook> {
  const fabric = await import("fabric");
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
    pngs.push(off.toDataURL({ format: "png", multiplier: 1 }));
  }
  off.dispose();

  const pdfBytes = await pagesPngToPdf(pngs, pageW);
  const pdfUrl = pdfBytesToBlobUrl(pdfBytes);
  const file = await pdfBytesToFile(pdfBytes, fileName);
  const rendered = await renderPdfToImages(file);

  return { rendered, pdfBytes, pdfUrl };
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
    const res = await fetch(`/api/books/${book.id}/pdf`, { cache: "no-store" });
    if (!res.ok) throw new Error("PDF를 불러오지 못했어요.");
    const blob = await res.blob();
    const file = new File([blob], `${book.title}.pdf`, {
      type: "application/pdf",
    });
    const rendered = await renderPdfToImages(file);
    return { rendered, revoke: () => revokePages(rendered) };
  }
  const { rendered, pdfUrl } = await renderSnapshotToImages(
    book.pages,
    `${book.title}.pdf`,
    book.pageW || PAGE_W,
  );
  return {
    rendered,
    revoke: () => {
      revokePages(rendered);
      URL.revokeObjectURL(pdfUrl);
    },
  };
}
