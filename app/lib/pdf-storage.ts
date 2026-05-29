import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * PDF blob storage on Cloudflare R2 via the S3-compatible API. The DB only
 * holds the book row + id; the PDF bytes live in R2 under `pdfs/<id>.pdf`.
 *
 * Env (set in .env.local / host): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_BUCKET. The client is created lazily so the module
 * can be imported even before R2 is configured — ops throw a clear error then.
 * Server-only; do NOT import from client components.
 */

let _client: S3Client | null = null;
let _bucket: string | null = null;

function r2(): { client: S3Client; bucket: string } {
  if (_client && _bucket) return { client: _client, bucket: _bucket };
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, " +
        "R2_SECRET_ACCESS_KEY, R2_BUCKET in .env.local.",
    );
  }
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  _bucket = bucket;
  return { client: _client, bucket: _bucket };
}

function keyFor(id: string): string {
  // id is a generated slug (no path separators), safe to use directly.
  return `pdfs/${id}.pdf`;
}

/**
 * Presigned PUT URL so the browser can upload the PDF *directly* to R2,
 * bypassing the serverless function body limit (Vercel caps request bodies at
 * ~4.5MB). The URL is short-lived and scoped to this one object key. No
 * ContentType is signed, so the client may PUT the bytes with no special
 * headers. Requires bucket CORS to allow PUT from the app origin.
 */
export async function presignPdfUpload(
  id: string,
  expiresInSeconds = 300,
): Promise<string> {
  const { client, bucket } = r2();
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: keyFor(id) }),
    { expiresIn: expiresInSeconds },
  );
}

/**
 * Editor snapshots (Fabric JSON with embedded images) can exceed Vercel's
 * ~4.5MB request-body limit. So the client uploads big snapshots straight to
 * R2 (presigned PUT under `snapshots/<uuid>.json`) and the write routes read
 * them back server-side (no request-body limit there) before storing in the
 * DB — read paths stay unchanged. The key is an unguessable UUID; reads are
 * restricted to the `snapshots/` prefix so this can't be used to fetch PDFs.
 */
export async function presignSnapshotUpload(): Promise<{
  key: string;
  url: string;
}> {
  const { client, bucket } = r2();
  const key = `snapshots/${globalThis.crypto.randomUUID()}.json`;
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 300 },
  );
  return { key, url };
}

/** Read an uploaded snapshot JSON back (server-side). Returns null if absent. */
export async function readSnapshotJson(key: string): Promise<string | null> {
  if (!key.startsWith("snapshots/")) {
    throw new Error("invalid snapshot key");
  }
  const { client, bucket } = r2();
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (!res.Body) return null;
    return await res.Body.transformToString();
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

/** Best-effort cleanup of a temp snapshot object after it's stored in the DB. */
export async function deleteSnapshot(key: string): Promise<void> {
  if (!key.startsWith("snapshots/")) return;
  try {
    const { client, bucket } = r2();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch {
    /* ignore */
  }
}

export async function savePdf(id: string, bytes: Uint8Array): Promise<void> {
  const { client, bucket } = r2();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: keyFor(id),
      Body: bytes,
      ContentType: "application/pdf",
    }),
  );
}

/** Presigned GET URL so the browser can download the PDF straight from R2
 * (free egress, no Vercel proxy). Requires bucket CORS to allow GET. */
export async function presignPdfDownload(
  id: string,
  expiresInSeconds = 300,
): Promise<string> {
  const { client, bucket } = r2();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: keyFor(id) }),
    { expiresIn: expiresInSeconds },
  );
}

export async function readPdf(id: string): Promise<Uint8Array | null> {
  const { client, bucket } = r2();
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: keyFor(id) }),
    );
    if (!res.Body) return null;
    return await res.Body.transformToByteArray();
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

// ---- Background music (MP3) per book, at audio/<id>.mp3 ----
function audioKeyFor(id: string): string {
  return `audio/${id}.mp3`;
}

/** Presigned PUT so the browser uploads the MP3 straight to R2. */
export async function presignAudioUpload(
  id: string,
): Promise<{ key: string; url: string }> {
  const { client, bucket } = r2();
  const key = audioKeyFor(id);
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 300 },
  );
  return { key, url };
}

/** Presigned GET so an <audio> element can stream it (no CORS needed). */
export async function presignAudioDownload(key: string): Promise<string> {
  const { client, bucket } = r2();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 3600 },
  );
}

export async function deleteAudio(id: string): Promise<void> {
  try {
    const { client, bucket } = r2();
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: audioKeyFor(id) }),
    );
  } catch {
    /* ignore */
  }
}

export async function deletePdf(id: string): Promise<void> {
  try {
    const { client, bucket } = r2();
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: keyFor(id) }),
    );
  } catch {
    /* ignore — best-effort cleanup */
  }
}
