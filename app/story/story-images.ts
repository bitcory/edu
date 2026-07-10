"use client";

/**
 * Client-side story image I/O. All heavy bytes move browser↔R2 directly via
 * presigned URLs — nothing bigger than a JSON key list passes through a Vercel
 * Function. Replaces the old save-image (base64 upload through the function),
 * image-data (base64 download through the function), and download-zip
 * (server-built zip) routes, which together blew the Fast Origin Transfer
 * free quota.
 */

export type SavedStoryImage = { key: string; url: string };

function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

/** Upload a data-URL image straight to R2 (presigned PUT). Returns the stored
 * key + a presigned display URL, or null on any failure so callers can keep
 * their optimistic data URL. */
export async function saveStoryImage(dataUrl: string): Promise<SavedStoryImage | null> {
  try {
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) return null;
    const r = await fetch("/api/story/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentType: blob.type }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || typeof d.key !== "string" || typeof d.uploadUrl !== "string") return null;
    const put = await fetch(d.uploadUrl, {
      method: "PUT",
      body: blob,
      headers: { "content-type": blob.type },
    });
    if (!put.ok) return null;
    return { key: d.key, url: typeof d.url === "string" ? d.url : "" };
  } catch {
    return null;
  }
}

/** Presigned GET URLs for story keys (small JSON round-trip only). */
export async function fetchStoryImageUrls(keys: string[]): Promise<Record<string, string>> {
  if (!keys.length) return {};
  const r = await fetch("/api/story/image-urls", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ keys }),
  });
  const d = await r.json().catch(() => ({}));
  return r.ok && d?.urls ? (d.urls as Record<string, string>) : {};
}

/** Fetch story images from R2 (presigned GET) and return base64 data URLs —
 * for the ChatGPT extension's file uploads, editor hand-off, and project
 * backups. Keys that fail to resolve are simply omitted. */
export async function fetchStoryImagesAsDataUrls(keys: string[]): Promise<Record<string, string>> {
  const urls = await fetchStoryImageUrls(keys);
  const out: Record<string, string> = {};
  await Promise.all(
    Object.entries(urls).map(async ([key, url]) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const blob = await res.blob();
        out[key] = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = () => reject(fr.error);
          fr.readAsDataURL(blob);
        });
      } catch {
        /* skip unreadable keys */
      }
    }),
  );
  return out;
}

// ---- Client-side ZIP (STORE method — images are already compressed) ----

function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function buildZip(files: { name: string; data: Uint8Array<ArrayBuffer> }[]): Blob {
  const encoder = new TextEncoder();
  const local: Uint8Array<ArrayBuffer>[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  for (const f of files) {
    const name = encoder.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true); // UTF-8 filename
    lh.setUint16(8, 0, true); // STORE
    lh.setUint16(10, 0, true);
    lh.setUint16(12, 0, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true);
    lh.setUint32(22, size, true);
    lh.setUint16(26, name.length, true);
    lh.setUint16(28, 0, true);
    local.push(new Uint8Array(lh.buffer), name, f.data);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, 0, true);
    ch.setUint16(14, 0, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, size, true);
    ch.setUint32(24, size, true);
    ch.setUint16(28, name.length, true);
    ch.setUint16(30, 0, true);
    ch.setUint16(32, 0, true);
    ch.setUint16(34, 0, true);
    ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);

    offset += 30 + name.length + f.data.length;
  }
  const centralLen = central.reduce((n, b) => n + b.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(4, 0, true);
  eocd.setUint16(6, 0, true);
  eocd.setUint16(8, files.length, true);
  eocd.setUint16(10, files.length, true);
  eocd.setUint32(12, centralLen, true);
  eocd.setUint32(16, offset, true);
  eocd.setUint16(20, 0, true);
  return new Blob([...local, ...central, new Uint8Array(eocd.buffer)], {
    type: "application/zip",
  });
}

/** Download the images for `items` straight from R2 and package them into a
 * ZIP in the browser. Returns the blob + how many images made it in, or null
 * if nothing could be read. */
export async function buildStoryImagesZip(
  items: { key: string; name: string }[],
): Promise<{ blob: Blob; count: number } | null> {
  const keys = items.map((it) => it.key).filter((k) => k.startsWith("story/"));
  if (!keys.length) return null;
  const urls = await fetchStoryImageUrls(keys);

  const used = new Set<string>();
  const files: { name: string; data: Uint8Array<ArrayBuffer> }[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const url = urls[it.key];
    if (!url) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = new Uint8Array(await res.arrayBuffer());
      const ext = (it.key.split(".").pop() || "png").toLowerCase();
      const base =
        (it.name || `character_${i + 1}`).replace(/[^\w가-힣.-]+/g, "_").slice(0, 60) ||
        `character_${i + 1}`;
      let name = `${base}.${ext}`;
      let n = 2;
      while (used.has(name)) name = `${base}_${n++}.${ext}`;
      used.add(name);
      files.push({ name, data });
    } catch {
      /* skip unreadable keys */
    }
  }
  if (!files.length) return null;
  return { blob: buildZip(files), count: files.length };
}
