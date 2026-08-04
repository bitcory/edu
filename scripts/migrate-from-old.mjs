// 옛 프로젝트(tbbookviewer: Neon + Cloudflare R2)의 그림책 데이터를 이 프로젝트로
// 가져온다. 일회성이지만 재실행해도 안전하게 짰다 — 2.78GB 를 받다가 끊기는 일이
// 흔해서, 이미 받은 것은 건너뛰고 이어받는다.
//
//   node scripts/migrate-from-old.mjs --owner toolb            전체
//   node scripts/migrate-from-old.mjs --owner toolb --blobs    파일만
//   node scripts/migrate-from-old.mjs --owner toolb --rows     DB만
//   node scripts/migrate-from-old.mjs --verify                 대조만
//
// 원본은 읽기만 한다. Neon 과 R2 에는 아무것도 쓰지 않는다.
//
// authors 는 일부러 가져오지 않는다 — 주민번호·계좌번호가 평문으로 들어 있고
// (원본 스키마 주석에도 경고가 있다) 이 서비스에 작가·정산 기능이 필요한지도
// 정해지지 않았다. 책 행이 owner_name 을 들고 있어 표시에는 지장이 없다.

import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OLD_ENV = "/Volumes/tb02/dev/tbbookviewer/.env.local";

/** 옮겨 오는 표. authors 는 위 사유로 제외. */
const TABLES = [
  "books",
  "likes",
  "comments",
  "reads",
  "bgm_tracks",
  "store_notices",
  "store_banners",
  "featured_books",
];

/* ---------------- 환경 ---------------- */

function parseEnv(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const m = /^([A-Z_0-9]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const oldEnv = parseEnv(await readFile(OLD_ENV, "utf8"));
const newEnv = parseEnv(await readFile(path.join(ROOT, ".env.local"), "utf8"));
const STORAGE = newEnv.STORAGE_DIR;
if (!STORAGE) throw new Error("STORAGE_DIR 을 찾지 못했어요 (.env.local).");

const doBlobs = has("--blobs") || (!has("--rows") && !has("--verify"));
const doRows = has("--rows") || (!has("--blobs") && !has("--verify"));
const ownerName = valueOf("--owner", "toolb");

const oldPool = new pg.Pool({
  connectionString: oldEnv.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});
const newPool = new pg.Pool({ connectionString: newEnv.DATABASE_URL, max: 5 });

const mb = (b) => (b / 1024 / 1024).toFixed(1) + "MB";

/* ---------------- 1) R2 → 로컬 디스크 ---------------- */

async function copyBlobs() {
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${oldEnv.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: oldEnv.R2_ACCESS_KEY_ID,
      secretAccessKey: oldEnv.R2_SECRET_ACCESS_KEY,
    },
  });

  // 먼저 목록을 다 받아 총량을 안 뒤 받는다 — 진행률을 보여 주려고.
  const objects = [];
  let token;
  do {
    const r = await s3.send(
      new ListObjectsV2Command({
        Bucket: oldEnv.R2_BUCKET,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );
    for (const o of r.Contents ?? []) objects.push({ key: o.Key, size: o.Size ?? 0 });
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);

  const total = objects.reduce((a, o) => a + o.size, 0);
  console.log(`\n[파일] ${objects.length}개 · ${mb(total)}`);

  let done = 0;
  let skipped = 0;
  let copied = 0;
  let bytes = 0;

  // 동시 6개. R2 는 넉넉하지만 디스크 쓰기가 병목이라 과하게 올리지 않는다.
  const queue = objects.slice();
  const worker = async () => {
    for (;;) {
      const o = queue.shift();
      if (!o) return;
      const dest = path.join(STORAGE, o.key);
      try {
        const s = await stat(dest);
        // 크기가 같으면 이미 받은 것으로 본다. 중단 후 재실행을 위한 것.
        if (s.size === o.size) {
          skipped++;
          done++;
          continue;
        }
      } catch {
        /* 없으면 받는다 */
      }
      await mkdir(path.dirname(dest), { recursive: true });
      const res = await s3.send(
        new GetObjectCommand({ Bucket: oldEnv.R2_BUCKET, Key: o.key }),
      );
      // 임시 파일에 받고 옮긴다 — 중간에 끊겨도 반쪽짜리가 남지 않게.
      const tmp = `${dest}.part`;
      await pipeline(res.Body, createWriteStream(tmp));
      const { rename } = await import("node:fs/promises");
      await rename(tmp, dest);
      copied++;
      bytes += o.size;
      done++;
      if (done % 50 === 0) {
        console.log(`  ${done}/${objects.length} · 받음 ${copied} · 건너뜀 ${skipped} · ${mb(bytes)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`[파일] 완료 — 받음 ${copied} · 건너뜀 ${skipped} · ${mb(bytes)}`);
}

/* ---------------- 2) Neon → 로컬 Postgres ---------------- */

async function copyRows() {
  const who = await newPool.query("SELECT user_id FROM users WHERE username = $1", [
    ownerName,
  ]);
  if (!who.rows[0]) throw new Error(`'${ownerName}' 계정을 찾지 못했어요.`);
  const ownerId = who.rows[0].user_id;
  console.log(`\n[DB] 소유자 → ${ownerName} (${ownerId})`);

  for (const table of TABLES) {
    let src;
    try {
      src = await oldPool.query(`SELECT * FROM ${table}`);
    } catch {
      console.log(`  ${table.padEnd(15)} 원본에 없음 — 건너뜀`);
      continue;
    }
    if (src.rows.length === 0) {
      console.log(`  ${table.padEnd(15)} 0행`);
      continue;
    }

    // 대상 표에 실제로 있는 열만 넣는다. 스키마가 조금씩 달라도 깨지지 않게.
    const cols = await newPool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    const allowed = new Set(cols.rows.map((r) => r.column_name));
    const fields = Object.keys(src.rows[0]).filter((f) => allowed.has(f));

    let inserted = 0;
    for (const row of src.rows) {
      const values = fields.map((f) => {
        // 소유권만 옮긴다. 옛 owner_id 는 Google sub 이라 이 시스템에서 로그인할
        // 수 있는 사람이 없어, 그대로 두면 아무도 손댈 수 없는 책이 된다.
        if ((table === "books" || table === "bgm_tracks") && f === "owner_id") {
          return ownerId;
        }
        // likes·reads·comments 의 user_id 는 원래 값을 유지한다. 이 값들은 "누가
        // 눌렀나" 를 세는 데만 쓰이고 로그인과 무관한데, 전부 한 사람으로 바꾸면
        // PK 가 (book_id, user_id[, period]) 라 서로 다른 사람의 기록이 한 행으로
        // 합쳐져 좋아요·조회수가 실제보다 줄어든다.
        return row[f];
      });
      const ph = fields.map((_, i) => `$${i + 1}`).join(", ");
      try {
        const r = await newPool.query(
          `INSERT INTO ${table} (${fields.join(", ")}) VALUES (${ph})
           ON CONFLICT DO NOTHING`,
          values,
        );
        inserted += r.rowCount ?? 0;
      } catch (e) {
        console.log(`    ! ${table} 행 실패: ${e.message.slice(0, 90)}`);
      }
    }
    console.log(`  ${table.padEnd(15)} 원본 ${src.rows.length}행 → 새로 넣은 것 ${inserted}행`);
  }
}

/* ---------------- 3) 대조 ---------------- */

async function verify() {
  console.log("\n[대조]");
  for (const table of TABLES) {
    let a = "-";
    try {
      a = (await oldPool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n;
    } catch {
      /* 원본에 없음 */
    }
    const b = (await newPool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n;
    const mark = String(a) === String(b) ? "✅" : "⚠️";
    console.log(`  ${mark} ${table.padEnd(15)} 원본 ${String(a).padStart(4)} · 이곳 ${String(b).padStart(4)}`);
  }

  // 행이 가리키는 블롭이 실제 디스크에 있는지 — 여기가 어긋나면 책이 열려도
  // 그림이 비어 보인다.
  const refs = await newPool.query(`
    SELECT snapshot_key AS k FROM books WHERE snapshot_key IS NOT NULL
    UNION ALL SELECT cover_key FROM books WHERE cover_key IS NOT NULL
    UNION ALL SELECT audio_key FROM books WHERE audio_key IS NOT NULL
    UNION ALL SELECT key FROM bgm_tracks WHERE key IS NOT NULL
    UNION ALL SELECT image_key FROM store_banners WHERE image_key IS NOT NULL`);
  let missing = 0;
  for (const r of refs.rows) {
    try {
      await stat(path.join(STORAGE, r.k));
    } catch {
      missing++;
      if (missing <= 5) console.log(`    빠진 파일: ${r.k}`);
    }
  }
  console.log(
    `  ${missing === 0 ? "✅" : "⚠️"} 블롭 참조 ${refs.rows.length}건 중 빠진 것 ${missing}건`,
  );
}

/* ---------------- 실행 ---------------- */

try {
  if (doBlobs) await copyBlobs();
  if (doRows) await copyRows();
  await verify();
  console.log("\n끝났어요.");
} finally {
  await oldPool.end();
  await newPool.end();
}
