// (1) Migrate narration from 3 orphan drafts to their published twins, then
// (2) delete every untitled ("제목 없는 책") draft and its R2 assets.
// Beta cleanup — approved by the owner. Read carefully; this DELETES rows.
//
// Usage: node --env-file=.env.local scripts/migrate-and-cleanup.mjs
import { neon } from "@neondatabase/serverless";
import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";

const sql = neon(process.env.DATABASE_URL);
const BUCKET = process.env.R2_BUCKET;
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// draftId → published twin id (from the content-based diagnosis).
const MIGRATIONS = [
  { draft: "a5guzygsmpy2lb4x", twin: "vt2wqoyampy3vd8t" }, // 100%
  { draft: "t2n6n9qzmqhfcxdl", twin: "fppwmik6mqhfsp6n" }, // 100%
  { draft: "3troaqitmq0z8iwo", twin: "moj9p37kmq12hr1f" }, // 90% (spot-check)
];

const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const narrKey = (id, i) => `narration/${id}/${i}.mp3`;
const parseArr = (s) => {
  if (!s) return [];
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
};

async function pageHashes(id, snapKey) {
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: snapKey || `snapshots/${id}.json` }),
    );
    const pages = JSON.parse(await res.Body.transformToString());
    return Array.isArray(pages) ? pages.map((p) => sha(JSON.stringify(p))) : [];
  } catch {
    return [];
  }
}

async function r2Copy(srcKey, dstKey) {
  await s3.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${encodeURIComponent(srcKey).replace(/%2F/g, "/")}`,
      Key: dstKey,
    }),
  );
}
async function r2Del(key) {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    /* ignore */
  }
}

const rows = await sql`SELECT id, title, status, narration, snapshot_key, cover_key, audio_key FROM books`;
const byId = new Map(rows.map((r) => [r.id, r]));

// ---- (1) Narration migration ----
const migratedDrafts = new Set();
console.log("■ 나레이션 복구\n");
for (const { draft, twin } of MIGRATIONS) {
  const d = byId.get(draft);
  const t = byId.get(twin);
  if (!d || !t) {
    console.log(`  ✗ ${draft} → ${twin}: 행을 찾을 수 없음 (건너뜀)`);
    continue;
  }
  const dNarr = parseArr(d.narration);
  const [dH, tH] = await Promise.all([
    pageHashes(draft, d.snapshot_key),
    pageHashes(twin, t.snapshot_key),
  ]);
  const out = [];
  let copied = 0;
  const mismatches = [];
  for (let i = 0; i < dNarr.length; i++) {
    const key = dNarr[i];
    if (!key) {
      out[i] = null;
      continue;
    }
    const dstKey = narrKey(twin, i);
    await r2Copy(key, dstKey);
    out[i] = dstKey;
    copied++;
    if (dH[i] && tH[i] && dH[i] !== tH[i]) mismatches.push(i);
  }
  await sql`UPDATE books SET narration = ${JSON.stringify(out)} WHERE id = ${twin}`;
  migratedDrafts.add(draft);
  console.log(
    `  ✓ ${draft} → ${twin}: 나레이션 ${copied}쪽 복구` +
      (mismatches.length
        ? `  ⚠ 페이지 내용이 다른 인덱스(확인 권장): ${mismatches.join(", ")}`
        : ""),
  );
}

// ---- (2) Delete untitled drafts ----
console.log("\n■ 제목 없는 임시저장본 삭제\n");
const toDelete = rows.filter(
  (r) => r.status === "draft" && (r.title ?? "").trim() === "제목 없는 책",
);
for (const r of toDelete) {
  // Never delete one of the 3 unless its narration migration succeeded.
  const isMigrationSource = MIGRATIONS.some((m) => m.draft === r.id);
  if (isMigrationSource && !migratedDrafts.has(r.id)) {
    console.log(`  ✗ ${r.id}: 나레이션 복구 실패라 보존`);
    continue;
  }
  // R2 cleanup: snapshot, cover, per-page narration, audio.
  if (r.snapshot_key) await r2Del(r.snapshot_key);
  else await r2Del(`snapshots/${r.id}.json`);
  if (r.cover_key) await r2Del(r.cover_key);
  for (let i = 0; i < parseArr(r.narration).length; i++) {
    if (parseArr(r.narration)[i]) await r2Del(parseArr(r.narration)[i]);
  }
  if (r.audio_key) await r2Del(`audio/${r.id}.mp3`);
  await sql`DELETE FROM likes WHERE book_id = ${r.id}`;
  await sql`DELETE FROM comments WHERE book_id = ${r.id}`;
  await sql`DELETE FROM reads WHERE book_id = ${r.id}`;
  await sql`DELETE FROM books WHERE id = ${r.id}`;
  console.log(`  ✓ 삭제 ${r.id}`);
}

const remaining = await sql`SELECT COUNT(*)::int AS n FROM books WHERE status = 'draft'`;
console.log(`\n완료. 남은 임시저장본: ${remaining[0].n}건`);
