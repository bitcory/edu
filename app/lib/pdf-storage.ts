import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Blob storage on the local filesystem. This app is self-hosted (Mac mini +
 * cloudflared), so object storage buys nothing — the bytes live under
 * STORAGE_DIR using the same key layout R2 used (`pdfs/<id>.pdf`,
 * `snapshots/<id>.json`, …), which keeps every key already recorded in the DB
 * valid. Server-only; do NOT import from client components.
 *
 * The `presign*` functions keep their old contract on purpose: they return a
 * URL the browser can GET (or PUT to) without extra headers. Instead of an S3
 * signature the URL carries an HMAC over `mode|key|expiry|filename`, verified
 * by app/api/files/[...key]/route.ts. Same capability-URL semantics as before —
 * holding the URL grants access to that one key until it expires — so callers
 * and all 23 consumer modules did not have to change.
 *
 * NOTE: that route is deliberately excluded from proxy.ts's matcher. With proxy
 * active Next buffers the whole request body in memory (10MB default) and
 * SILENTLY TRUNCATES beyond it — which would corrupt large PDF/MP3 uploads.
 * The route authenticates via the URL signature instead of the session.
 */

/** Key prefixes this module is allowed to touch — guards path traversal. */
const ALLOWED_PREFIXES = [
  "pdfs/",
  "snapshots/",
  "covers/",
  "story/",
  "banners/",
  "authors/",
  "audio/",
  "narration/",
  "bgm/",
  // 「그림책 만들기」의 미리 만들어 둔 그림. 표지로 복사할 때 여기서 읽는다.
  // 사용자 데이터가 아니라 앱과 함께 두는 정적 자산이라 노출 위험이 없다
  // (이미 /api/make/img 로 로그인한 누구나 볼 수 있다).
  "make/",
] as const;

export function storageRoot(): string {
  const dir = process.env.STORAGE_DIR;
  if (!dir) {
    throw new Error(
      "STORAGE_DIR is not set. Point it at the blob storage root in .env.local (and the host's env).",
    );
  }
  return dir;
}

/** Reject anything that could escape the storage root or hit an unknown area. */
export function assertValidKey(key: string): void {
  if (
    !key ||
    key.startsWith("/") ||
    key.includes("..") ||
    key.includes("\0") ||
    !ALLOWED_PREFIXES.some((p) => key.startsWith(p))
  ) {
    throw new Error(`invalid storage key: ${key}`);
  }
}

function fileFor(key: string): string {
  assertValidKey(key);
  return path.join(storageRoot(), key);
}

function signingSecret(): string {
  const s = process.env.FILE_SIGNING_SECRET;
  if (!s) {
    throw new Error(
      "FILE_SIGNING_SECRET is not set. Add it to .env.local (and the host's env).",
    );
  }
  return s;
}

type Mode = "r" | "w";

function signature(mode: Mode, key: string, exp: number, dl: string): string {
  return createHmac("sha256", signingSecret())
    .update(`${mode}|${key}|${exp}|${dl}`)
    .digest("base64url");
}

/** Constant-time check used by the file route. Never throws on bad input. */
export function verifySignature(
  mode: Mode,
  key: string,
  exp: number,
  dl: string,
  sig: string,
): boolean {
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  let expected: string;
  try {
    expected = signature(mode, key, exp, dl);
  } catch {
    return false;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Build the capability URL the browser uses to read or write one key. */
function signUrl(
  mode: Mode,
  key: string,
  expiresInSeconds: number,
  downloadName = "",
): string {
  assertValidKey(key);
  const exp = Date.now() + expiresInSeconds * 1000;
  const sig = signature(mode, key, exp, downloadName);
  const params = new URLSearchParams({ m: mode, exp: String(exp), sig });
  if (downloadName) params.set("dl", downloadName);
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `/api/files/${encoded}?${params.toString()}`;
}

async function writeKey(key: string, body: Buffer | string): Promise<void> {
  const file = fileFor(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

async function readKey(key: string): Promise<Buffer | null> {
  try {
    return await readFile(fileFor(key));
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw err;
  }
}

async function deleteKey(key: string): Promise<void> {
  try {
    await rm(fileFor(key), { force: true });
  } catch {
    /* best-effort cleanup */
  }
}

function keyFor(id: string): string {
  // id is a generated slug (no path separators), safe to use directly.
  return `pdfs/${id}.pdf`;
}

/** Short-lived PUT URL so the browser can upload the PDF for this one key. */
export async function presignPdfUpload(
  id: string,
  expiresInSeconds = 300,
): Promise<string> {
  return signUrl("w", keyFor(id), expiresInSeconds);
}

/**
 * Editor snapshots (Fabric JSON with embedded images) are uploaded to their own
 * temp key first, then read back server-side by the write routes before being
 * stored on the row. The key is an unguessable UUID; reads are restricted to
 * the `snapshots/` prefix so this can't be used to fetch PDFs.
 */
export async function presignSnapshotUpload(): Promise<{
  key: string;
  url: string;
}> {
  const key = `snapshots/${randomUUID()}.json`;
  return { key, url: signUrl("w", key, 300) };
}

/** Read an uploaded snapshot JSON back (server-side). Returns null if absent. */
export async function readSnapshotJson(key: string): Promise<string | null> {
  if (!key.startsWith("snapshots/")) {
    throw new Error("invalid snapshot key");
  }
  const buf = await readKey(key);
  return buf ? buf.toString("utf8") : null;
}

/** GET URL so the browser can fetch a book's snapshot JSON directly. */
export async function presignSnapshotDownload(
  key: string,
  expiresInSeconds = 300,
): Promise<string> {
  if (!key.startsWith("snapshots/")) {
    throw new Error("invalid snapshot key");
  }
  return signUrl("r", key, expiresInSeconds);
}

/** Best-effort cleanup of a temp snapshot file after it's stored in the DB. */
export async function deleteSnapshot(key: string): Promise<void> {
  if (!key.startsWith("snapshots/")) return;
  await deleteKey(key);
}

/** Stable per-book snapshot key — overwritten on each save (no key churn). */
export function bookSnapshotKey(bookId: string): string {
  return `snapshots/${bookId}.json`;
}

/** Server-side write of a book's page snapshot JSON under its stable key.
 * Returns the key so the caller can record it on the row. */
export async function saveSnapshot(
  bookId: string,
  json: string,
): Promise<string> {
  const key = bookSnapshotKey(bookId);
  await writeKey(key, json);
  return key;
}

/**
 * Book cover images. Covers used to be base64 data URLs stored in the DB and
 * inlined into every list response (~140KB × every book × every store visit).
 * Now the bytes live on disk under a stable per-book key and responses carry a
 * signed GET URL instead.
 */
function coverKeyFor(bookId: string): string {
  return `covers/${bookId}.jpg`;
}

/** Decode a base64 image data URL and store it as the book's cover.
 * Returns the key, or null if the value isn't a data URL. */
export async function saveCoverFromDataUrl(
  bookId: string,
  dataUrl: string,
): Promise<string | null> {
  const m = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const key = coverKeyFor(bookId);
  await writeKey(key, Buffer.from(m[2], "base64"));
  return key;
}

/**
 * 이미 저장소에 있는 그림을 그 책의 표지로 복사한다.
 *
 * saveCoverFromDataUrl 은 브라우저가 올린 data URL 만 받는데, 「그림책 만들기」의
 * 그림은 처음부터 파일로 들어와 있어서 그 경로를 탈 수 없다.
 *
 * 확장자는 원본을 따른다. coverKeyFor 는 .jpg 로 고정돼 있지만 PNG 를 .jpg 로
 * 저장하면 서빙 라우트가 content-type 을 image/jpeg 로 붙여 실제 내용과 어긋난다.
 * 키는 행에 저장되므로 확장자가 달라도 기존 책과 섞이지 않는다.
 */
export async function copyCoverFromKey(
  bookId: string,
  sourceKey: string,
): Promise<string | null> {
  const bytes = await readKey(sourceKey);
  if (!bytes) return null; // 아직 그림이 없으면(플레이스홀더) 표지도 없다
  const ext = path.extname(sourceKey).toLowerCase() || ".png";
  const key = `covers/${bookId}${ext}`;
  await writeKey(key, bytes);
  return key;
}

/** GET URL for a cover image. 1h: list pages render <img> tags that may be
 * (re)loaded well after the fetch, so don't cut it too close. */
export async function presignCoverDownload(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  return signUrl("r", key, expiresInSeconds);
}

export async function deleteCover(key: string): Promise<void> {
  if (!key.startsWith("covers/")) return;
  await deleteKey(key);
}

/** PUT URL for a story image under story/<uuid>.<ext>. */
export async function presignStoryUpload(
  contentType: string,
  expiresInSeconds = 600,
): Promise<{ key: string; url: string }> {
  const m = /^image\/([\w.+-]+)$/.exec(contentType);
  if (!m) throw new Error("invalid image content type");
  const ext = (m[1] || "png").split("+")[0];
  const key = `story/${randomUUID()}.${ext}`;
  return { key, url: signUrl("w", key, expiresInSeconds) };
}

/** PUT URL for a store home event banner image under banners/<uuid>.<ext>
 * — admin only (라우트에서 가드). */
export async function presignBannerUpload(
  contentType: string,
  expiresInSeconds = 600,
): Promise<{ key: string; url: string }> {
  const m = /^image\/([\w.+-]+)$/.exec(contentType);
  if (!m) throw new Error("invalid image content type");
  const ext = (m[1] || "png").split("+")[0];
  const key = `banners/${randomUUID()}.${ext}`;
  return { key, url: signUrl("w", key, expiresInSeconds) };
}

/** GET URL for a banner image (banners/ prefix only). */
export async function presignBannerDownload(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  if (!key.startsWith("banners/")) throw new Error("invalid banner key");
  return signUrl("r", key, expiresInSeconds);
}

/** Delete a banner image (row deletion 시 함께 호출). */
export async function deleteBannerImage(key: string): Promise<void> {
  if (!key.startsWith("banners/")) return;
  await deleteKey(key);
}

/** GET URL for a story image (story/ prefix only). Pass downloadName to force
 * a browser download via Content-Disposition. */
export async function presignStoryDownload(
  key: string,
  expiresInSeconds = 3600,
  downloadName?: string,
): Promise<string> {
  if (!key.startsWith("story/")) throw new Error("invalid story key");
  return signUrl("r", key, expiresInSeconds, downloadName ?? "");
}

/** Store a square author avatar data URL under authors/<uuid>.<ext>. */
export async function saveAuthorAvatarFromDataUrl(
  dataUrl: string,
): Promise<string | null> {
  const m = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const ext = (m[1].split("/")[1] || "png").split("+")[0];
  const key = `authors/${randomUUID()}.${ext}`;
  await writeKey(key, Buffer.from(m[2], "base64"));
  return key;
}

export async function presignAuthorAvatarDownload(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  if (!key.startsWith("authors/")) throw new Error("invalid author avatar key");
  return signUrl("r", key, expiresInSeconds);
}

export async function savePdf(id: string, bytes: Uint8Array): Promise<void> {
  await writeKey(keyFor(id), Buffer.from(bytes));
}

/** GET URL so the browser can download the PDF directly. */
export async function presignPdfDownload(
  id: string,
  expiresInSeconds = 300,
): Promise<string> {
  return signUrl("r", keyFor(id), expiresInSeconds);
}

export async function readPdf(id: string): Promise<Uint8Array | null> {
  const buf = await readKey(keyFor(id));
  return buf ? new Uint8Array(buf) : null;
}

// ---- Background music (MP3) per book, at audio/<id>.mp3 ----
function audioKeyFor(id: string): string {
  return `audio/${id}.mp3`;
}

/** PUT URL so the browser uploads the MP3 for this book. */
export async function presignAudioUpload(
  id: string,
): Promise<{ key: string; url: string }> {
  const key = audioKeyFor(id);
  return { key, url: signUrl("w", key, 300) };
}

/** GET URL so an <audio> element can stream it (Range supported by the route). */
export async function presignAudioDownload(key: string): Promise<string> {
  return signUrl("r", key, 3600);
}

export async function deleteAudio(id: string): Promise<void> {
  await deleteKey(audioKeyFor(id));
}

export async function deletePdf(id: string): Promise<void> {
  await deleteKey(keyFor(id));
}

// ---- Per-page narration (MP3), at narration/<bookId>/<pageIndex>.mp3 ----
export function narrationKeyFor(bookId: string, index: number): string {
  return `narration/${bookId}/${index}.mp3`;
}

/** PUT URL so the browser uploads a page's narration. */
export async function presignNarrationUpload(
  bookId: string,
  index: number,
): Promise<{ key: string; url: string }> {
  const key = narrationKeyFor(bookId, index);
  return { key, url: signUrl("w", key, 300) };
}

/** GET URL so an <audio> element can stream a page's narration. */
export async function presignNarrationDownload(key: string): Promise<string> {
  return signUrl("r", key, 3600);
}

export async function deleteNarration(key: string): Promise<void> {
  if (!key.startsWith("narration/")) return;
  await deleteKey(key);
}

// ---- Shared background-music pool (MP3), at bgm/<trackId>.mp3 ----
function bgmKeyFor(id: string): string {
  return `bgm/${id}.mp3`;
}

/** PUT URL so an author uploads a pool track. */
export async function presignBgmUpload(
  id: string,
): Promise<{ key: string; url: string }> {
  const key = bgmKeyFor(id);
  return { key, url: signUrl("w", key, 300) };
}

/** GET URL so an <audio> element can stream a pool track. */
export async function presignBgmDownload(key: string): Promise<string> {
  return signUrl("r", key, 3600);
}

export async function deleteBgm(key: string): Promise<void> {
  if (!key.startsWith("bgm/")) return;
  await deleteKey(key);
}
