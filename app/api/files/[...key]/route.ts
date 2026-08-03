import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { NextRequest } from "next/server";
import {
  assertValidKey,
  storageRoot,
  verifySignature,
} from "../../../lib/pdf-storage";

/**
 * Serves and accepts the blob storage that used to live in R2. Access is
 * granted by the HMAC signature on the URL (see app/lib/pdf-storage.ts), not by
 * the session — the same capability-URL model R2 presigned URLs had.
 *
 * This route is excluded from proxy.ts's matcher on purpose. With proxy active
 * Next buffers the entire request body in memory (10MB by default) and silently
 * truncates past the limit, which would corrupt large PDF and MP3 uploads. Off
 * the matcher the body streams straight to disk and nothing is buffered.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".mp3": "audio/mpeg",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function contentTypeFor(key: string): string {
  return CONTENT_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream";
}

/** Resolve + authorize the key carried in the path, or return an error status. */
function resolve(
  req: NextRequest,
  segments: string[],
  mode: "r" | "w",
): { key: string; file: string; dl: string } | number {
  const key = segments.join("/");
  try {
    assertValidKey(key);
  } catch {
    return 400;
  }
  const q = req.nextUrl.searchParams;
  if (q.get("m") !== mode) return 403;
  const exp = Number(q.get("exp"));
  const dl = q.get("dl") ?? "";
  const sig = q.get("sig") ?? "";
  if (!verifySignature(mode, key, exp, dl, sig)) return 403;
  return { key, file: path.join(storageRoot(), key), dl };
}

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/files/[...key]">,
) {
  const { key } = await ctx.params;
  const resolved = resolve(req, key, "r");
  if (typeof resolved === "number") {
    return new Response(null, { status: resolved });
  }

  let size: number;
  try {
    const s = await stat(resolved.file);
    if (!s.isFile()) return new Response(null, { status: 404 });
    size = s.size;
  } catch {
    return new Response(null, { status: 404 });
  }

  const headers = new Headers({
    "content-type": contentTypeFor(resolved.key),
    "accept-ranges": "bytes",
    // Capability URLs expire, so let the browser reuse the bytes until then.
    "cache-control": "private, max-age=300",
  });
  if (resolved.dl) {
    headers.set(
      "content-disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(resolved.dl)}`,
    );
  }

  // Range support matters for <audio> seeking (narration and BGM playback).
  const range = req.headers.get("range");
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (m && (m[1] || m[2])) {
    let start: number;
    let end: number;
    if (m[1]) {
      start = Number(m[1]);
      end = m[2] ? Number(m[2]) : size - 1;
    } else {
      // Suffix form `bytes=-N` — the last N bytes.
      start = Math.max(0, size - Number(m[2]));
      end = size - 1;
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
      return new Response(null, {
        status: 416,
        headers: { "content-range": `bytes */${size}` },
      });
    }
    end = Math.min(end, size - 1);
    headers.set("content-range", `bytes ${start}-${end}/${size}`);
    headers.set("content-length", String(end - start + 1));
    const stream = Readable.toWeb(
      createReadStream(resolved.file, { start, end }),
    ) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }

  headers.set("content-length", String(size));
  const stream = Readable.toWeb(
    createReadStream(resolved.file),
  ) as ReadableStream;
  return new Response(stream, { status: 200, headers });
}

export async function PUT(
  req: NextRequest,
  ctx: RouteContext<"/api/files/[...key]">,
) {
  const { key } = await ctx.params;
  const resolved = resolve(req, key, "w");
  if (typeof resolved === "number") {
    return new Response(null, { status: resolved });
  }
  if (!req.body) return new Response(null, { status: 400 });

  // Stream to a sibling temp file, then rename — a failed upload can never
  // leave a half-written object at the real key.
  await mkdir(path.dirname(resolved.file), { recursive: true });
  const tmp = `${resolved.file}.${process.pid}.part`;
  try {
    await pipeline(
      Readable.fromWeb(req.body as Parameters<typeof Readable.fromWeb>[0]),
      createWriteStream(tmp),
    );
    await rename(tmp, resolved.file);
  } catch (err) {
    await import("node:fs/promises").then(({ rm }) =>
      rm(tmp, { force: true }).catch(() => {}),
    );
    throw err;
  }
  return new Response(null, { status: 200 });
}
