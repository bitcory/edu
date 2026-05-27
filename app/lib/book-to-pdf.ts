"use client";

import { PDFDocument } from "pdf-lib";
import { PAGE_H, PAGE_W } from "./editor-types";

/**
 * Build a PDF from page image data URLs (PNG). Each PDF page has the same
 * pixel dimensions as the source canvas (PAGE_W x PAGE_H).
 */
export async function pagesPngToPdf(pngDataUrls: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const dataUrl of pngDataUrls) {
    const bytes = dataUrlToBytes(dataUrl);
    const img = await doc.embedPng(bytes);
    const page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawImage(img, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
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
