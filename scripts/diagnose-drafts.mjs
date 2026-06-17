// Read-only diagnosis of accumulated 임시저장(draft) books — CONTENT based.
// Drafts are all titled "제목 없는 책", so we can't match by title. Instead we
// fetch each book's page snapshot from R2 and compare a draft against every
// APPROVED book by the SAME owner via page-level content hashes. A draft whose
// pages match a published book is an orphan duplicate (left behind by the old
// publish-creates-new-row bug). We also compare narration so a draft that holds
// narration its published twin lacks is flagged RISKY, never auto-safe.
//
// Usage: node --env-file=.env.local scripts/diagnose-drafts.mjs
import { neon } from "@neondatabase/serverless";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";

const sql = neon(process.env.DATABASE_URL);
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET;

const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

async function pageHashes(book) {
  const key = book.snapshot_key || `snapshots/${book.id}.json`;
  let json;
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    json = await res.Body.transformToString();
  } catch {
    // Legacy rows may carry inline pages in the DB column instead.
    json = book.pages && book.pages !== "[]" ? book.pages : null;
  }
  if (!json) return [];
  try {
    const pages = JSON.parse(json);
    return Array.isArray(pages) ? pages.map((p) => sha(JSON.stringify(p))) : [];
  } catch {
    return [];
  }
}

const narrCount = (n) => {
  if (!n) return 0;
  try {
    return JSON.parse(n).filter(Boolean).length;
  } catch {
    return 0;
  }
};

// Jaccard similarity of two page-hash sets.
function similarity(a, b) {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const inter = a.filter((h) => setB.has(h)).length;
  return inter / new Set([...a, ...b]).size;
}

const rows = await sql`
  SELECT id, title, owner_id, owner_name, status, page_count, narration,
         snapshot_key, pages, submitted_at
  FROM books`;

console.log(`스냅샷 읽는 중… (총 ${rows.length}권)`);
for (const r of rows) r._h = await pageHashes(r);

const drafts = rows.filter((r) => r.status === "draft");
const approved = rows.filter((r) => r.status === "approved");
console.log(`임시저장 ${drafts.length} · 공개 ${approved.length}\n`);

const safe = [];
const risky = [];
const standalone = [];

for (const d of drafts) {
  const dN = narrCount(d.narration);
  const twins = approved
    .filter((a) => a.owner_id === d.owner_id)
    .map((a) => ({ a, sim: similarity(d._h, a._h), aN: narrCount(a.narration) }))
    .filter((t) => t.sim >= 0.6) // 60%+ pages identical = same book
    .sort((x, y) => y.sim - x.sim);

  if (twins.length === 0) {
    standalone.push({ d, dN });
    continue;
  }
  const twinMaxN = Math.max(...twins.map((t) => t.aN));
  const rec = { d, dN, twins, twinMaxN };
  if (dN > twinMaxN) risky.push(rec);
  else safe.push(rec);
}

const twinStr = (twins) =>
  twins.map((t) => `${t.a.id}(${(t.sim * 100).toFixed(0)}%,나레${t.aN})`).join(", ");
const line = (r) =>
  `  [${r.d.id}] ${r.d.owner_name} · ${r.d.page_count ?? "?"}쪽 · 나레이션 ${r.dN}쪽` +
  (r.twins ? `\n      → 공개본: ${twinStr(r.twins)}` : "");

console.log(`■ 삭제해도 안전 (내용이 일치하는 공개본 있고, 나레이션도 공개본이 같거나 많음): ${safe.length}건`);
safe.forEach((r) => console.log(line(r)));
console.log(`\n■ 주의 — 임시저장본에만 나레이션이 더 있음 (먼저 원본에 옮겨야 함): ${risky.length}건`);
risky.forEach((r) => console.log(line(r)));
console.log(`\n■ 단독 임시저장 (일치하는 공개본 없음 — 진짜 작업중일 수 있어 보존): ${standalone.length}건`);
standalone.forEach((r) => console.log(line(r)));
console.log("");

// Emit machine-readable ids for the (future) deletion step.
console.log("SAFE_IDS=" + safe.map((r) => r.d.id).join(","));
console.log("RISKY_IDS=" + risky.map((r) => r.d.id).join(","));
