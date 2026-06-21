"use client";

/**
 * Build editor pages from story images, replicating the editor's "전체추가"
 * (addAllFromFolder) output exactly: each content image becomes a left/right
 * spread pair in the default layout (or one page in webtoon), and covers become
 * a single page. The result is fed through saveDraft → /edit?book=<id>, so the
 * book opens already laid out.
 */
import { PAGE_W, PAGE_H, makePage, type EditorPage } from "../lib/editor-types";
import type { BookLayout } from "../lib/book-types";

const rnd = () => Math.random().toString(36).slice(2, 10);

// Same downscale+reencode the editor applies on import (caps size, JPEG for
// large opaque images so snapshots stay small).
async function downscaleImageDataUrl(dataUrl: string, maxDim: number): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("image decode failed"));
    el.src = dataUrl;
  });
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longest > maxDim ? maxDim / longest : 1;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  let hasAlpha = false;
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) { hasAlpha = true; break; }
    }
  } catch {
    hasAlpha = true;
  }
  const png = canvas.toDataURL("image/png");
  if (hasAlpha || png.length <= 700_000) return png;
  return canvas.toDataURL("image/jpeg", 0.85);
}

type FabricNS = typeof import("fabric");

async function pagesForImage(
  fabric: FabricNS,
  dataUrl: string,
  kind: "cover" | "content",
  layout: BookLayout,
  single: boolean,
): Promise<EditorPage[]> {
  const MAX_DIM = Math.max(PAGE_W, PAGE_H) * (layout === "webtoon" ? 2.4 : 2);
  const url = await downscaleImageDataUrl(dataUrl, MAX_DIM);
  const img = await fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" });
  const ih = img.height ?? PAGE_H;
  const iw = img.width ?? PAGE_W;
  const scale = PAGE_H / ih;
  const scaledW = iw * scale;

  const canvas = new fabric.StaticCanvas(document.createElement("canvas"), {
    width: PAGE_W,
    height: PAGE_H,
    backgroundColor: "#ffffff",
  });

  // Single page: covers, back cover, or webtoon layout. Center on one page.
  if (single || layout === "webtoon") {
    img.set({ scaleX: scale, scaleY: scale, angle: 0, left: (PAGE_W - scaledW) / 2, top: 0 });
    canvas.add(img);
    canvas.requestRenderAll();
    const data = canvas.toObject(["caption"]);
    const thumb = canvas.toDataURL({ format: "png", multiplier: 0.2 });
    canvas.dispose();
    return [{ id: rnd(), kind, data, thumb }];
  }

  // Default layout: one image → left/right spread pair (rightLeft = leftLeft − PAGE_W).
  const isWide = scaledW > PAGE_W + 1;
  const leftPageLeft = isWide ? 0 : (PAGE_W * 2 - scaledW) / 2;

  img.set({ scaleX: scale, scaleY: scale, angle: 0, left: leftPageLeft, top: 0 });
  canvas.add(img);
  canvas.requestRenderAll();
  const leftData = canvas.toObject(["caption"]);
  const leftThumb = canvas.toDataURL({ format: "png", multiplier: 0.2 });
  const spreadId = rnd();

  img.set({ left: leftPageLeft - PAGE_W });
  canvas.requestRenderAll();
  const rightData = canvas.toObject(["caption"]);
  const rightThumb = canvas.toDataURL({ format: "png", multiplier: 0.2 });
  canvas.dispose();

  return [
    { id: rnd(), kind, data: leftData, thumb: leftThumb, spreadId, spreadSide: "left" },
    { id: rnd(), kind, data: rightData, thumb: rightThumb, spreadId, spreadSide: "right" },
  ];
}

/** front cover → cover page · cuts → content spreads (page 1..) · back cover → last page. */
export async function buildBookPages(opts: {
  front?: string;
  cuts: string[];
  back?: string;
  layout: BookLayout;
}): Promise<EditorPage[]> {
  const fabric = await import("fabric");
  const pages: EditorPage[] = [];

  // Cover (page 0).
  if (opts.front) pages.push(...(await pagesForImage(fabric, opts.front, "cover", opts.layout, true)));
  else pages.push(makePage("cover"));

  // Content (cuts) — page 1 onward.
  for (const cut of opts.cuts) {
    pages.push(...(await pagesForImage(fabric, cut, "content", opts.layout, false)));
  }

  // Back cover — appended last as a single page.
  if (opts.back) pages.push(...(await pagesForImage(fabric, opts.back, "content", opts.layout, true)));

  return pages;
}
