// One-off: move each editor book's page snapshot out of Postgres into R2.
// After this, DB rows are tiny (pages='[]') and snapshot_key points at R2.
// Run: node migrate-snapshots.mjs
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const env = readFileSync(".env.local", "utf8");
const get = (k) =>
  (env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] ?? "").trim().replace(/^["']|["']$/g, "");

const sql = neon(get("DATABASE_URL"));
const bucket = get("R2_BUCKET");
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: get("R2_ACCESS_KEY_ID"),
    secretAccessKey: get("R2_SECRET_ACCESS_KEY"),
  },
});

// Ensure the new columns exist (idempotent).
await sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS snapshot_key TEXT`;
await sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS page_count INTEGER`;

const rows = await sql`
  SELECT id, title, pages FROM books
  WHERE (snapshot_key IS NULL OR snapshot_key = '')
    AND pages IS NOT NULL AND pages <> '[]'`;

console.log(`books to migrate: ${rows.length}`);
let ok = 0;
for (const r of rows) {
  let pages;
  try {
    pages = JSON.parse(r.pages);
  } catch {
    console.log(`  SKIP (bad JSON): ${r.id} ${r.title}`);
    continue;
  }
  if (!Array.isArray(pages)) {
    console.log(`  SKIP (not array): ${r.id} ${r.title}`);
    continue;
  }
  const key = `snapshots/${r.id}.json`;
  const body = JSON.stringify(pages);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/json",
    }),
  );
  await sql`
    UPDATE books
    SET snapshot_key = ${key}, page_count = ${pages.length}, pages = '[]'
    WHERE id = ${r.id}`;
  ok++;
  console.log(
    `  ✓ ${r.title} → ${key} (${pages.length} pages, ${(body.length / 1024 / 1024).toFixed(1)} MB)`,
  );
}
console.log(`\ndone: ${ok}/${rows.length} migrated`);

const [after] = await sql`SELECT pg_database_size(current_database()) AS s, sum(length(pages)) AS p FROM books`;
console.log(
  `DB logical size now: ${(Number(after.s) / 1024 / 1024).toFixed(1)} MB | pages column total: ${(Number(after.p) / 1024).toFixed(1)} KB`,
);
