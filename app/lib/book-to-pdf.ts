"use client";

import { PDFDocument } from "pdf-lib";
import { PAGE_H, PAGE_W } from "./editor-types";

/**
 * Build a PDF from page image data URLs (PNG). Each PDF page is pageW x PAGE_H
 * (height fixed; width varies by 판형).
 */
export async function pagesPngToPdf(
  pngDataUrls: string[],
  pageW: number = PAGE_W,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const dataUrl of pngDataUrls) {
    const bytes = dataUrlToBytes(dataUrl);
    const img = await doc.embedPng(bytes);
    const page = doc.addPage([pageW, PAGE_H]);
    page.drawImage(img, { x: 0, y: 0, width: pageW, height: PAGE_H });
  }
  return doc.save();
}

function dataUrlToBytes(url: string): Uint8Array {
  const comma = url.indexOf(",");
  const b64 = url.slice(comma + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function pdfBytesToBlobUrl(bytes: Uint8Array): string {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return URL.createObjectURL(new Blob([buf], { type: "application/pdf" }));
}

export async function pdfBytesToFile(
  bytes: Uint8Array,
  name: string,
): Promise<File> {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return new File([buf], name, { type: "application/pdf" });
}
