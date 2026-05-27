"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

export type RenderedPage = {
  url: string;
  width: number;
  height: number;
};

export type ProgressCallback = (current: number, total: number) => void;

let workerConfigured = false;

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerConfigured = true;
  }
  return pdfjs;
}

export async function renderPdfToImages(
  file: File,
  onProgress?: ProgressCallback,
  targetWidth = 1200,
): Promise<RenderedPage[]> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf: PDFDocumentProxy = await pdfjs.getDocument({ data }).promise;
  const total = pdf.numPages;
  const pages: RenderedPage[] = [];

  for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d canvas context unavailable");

    await page.render({ canvasContext: ctx, viewport }).promise;

    const url: string = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("toBlob failed"));
          resolve(URL.createObjectURL(blob));
        },
        "image/jpeg",
        0.85,
      );
    });

    pages.push({ url, width: canvas.width, height: canvas.height });
    page.cleanup();
    onProgress?.(pageNumber, total);
  }

  await pdf.cleanup();
  await pdf.destroy();
  return pages;
}

export function revokePages(pages: RenderedPage[]) {
  for (const p of pages) URL.revokeObjectURL(p.url);
}
