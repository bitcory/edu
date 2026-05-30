"use client";

/**
 * Cover-thumbnail helpers. Store cards only need a small image, so we downscale
 * aggressively and re-encode as JPEG — this keeps the data URL tiny (a few KB)
 * so the store grid loads fast. Shared by the PDF-upload and editor-submit flows
 * for a consistent cover across both.
 */

// Store cards show the cover at 4:5, up to ~320px wide → 2× (retina) ≈ 640px.
// 640px JPEG @0.72 stays tiny (~40–80KB) while looking crisp on the grid.
const DEFAULT_MAX_W = 640;
const DEFAULT_QUALITY = 0.72;

function drawToJpeg(
  img: HTMLImageElement,
  maxW: number,
  quality: number,
): string | undefined {
  const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
  const w = Math.max(1, Math.round((img.naturalWidth || maxW) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || maxW) * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return undefined;
  // White matte so transparent PNGs don't turn black under JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", quality);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = src;
  });
}

/** Compress an image URL (e.g. a rendered page) into a small JPEG data URL. */
export async function urlToThumb(
  url: string,
  maxW = DEFAULT_MAX_W,
  quality = DEFAULT_QUALITY,
): Promise<string | undefined> {
  try {
    const img = await loadImage(url);
    return drawToJpeg(img, maxW, quality);
  } catch {
    return undefined;
  }
}

/** Compress a user-picked image File into a small JPEG data URL. */
export async function fileToThumb(
  file: File,
  maxW = DEFAULT_MAX_W,
  quality = DEFAULT_QUALITY,
): Promise<string | undefined> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    return drawToJpeg(img, maxW, quality);
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
