// 표지를 원본 해상도로 다시 만든다.
//
//   node scripts/refresh-covers.mjs                    무엇이 바뀔지만 보여 준다
//   node scripts/refresh-covers.mjs --apply            실제로 바꾼다
//   node scripts/refresh-covers.mjs --apply --width 720   폭을 바꿔서
//
// 왜 필요한가: 표지 폭이 제각각이었다 — 대부분 560px 이지만 17개는 160px 라
// 눈에 띄게 뭉개졌다. 전부 같은 폭으로 맞춘다.
//
// 스냅샷 1쪽에 원본 그림이 그대로 들어 있어(중앙값 1086px) 거기서 다시 뽑는다.
//
// 1쪽에 사람이 직접 쓴 글자가 있으면 건너뛴다 — 그림만 뽑으면 그 글자가
// 사라지기 때문이다. 다만 "내 그림책 제목" 같은 편집기 기본 문구는 작가가
// 지우지 않은 자리표시일 뿐이라, 오히려 빼는 편이 낫다(지금 표지에 그대로
// 찍혀 있다).

import { readFile, writeFile, stat, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");

/** 편집기가 처음 깔아 주는 문구. 작가가 손대지 않은 자리표시로 본다. */
const PLACEHOLDER = /^(내 그림책 제목|부제 또는 지은이|제목을 입력하세요|텍스트를 입력하세요|텍스트)\s*$/;

/** 목록 카드는 화면에서 250px 안팎이라 540 이면 고해상도 화면에서도 2배다.
 * 더 키워 봐야 눈에 띄지 않고 목록만 무거워진다. --width 로 바꿀 수 있다. */
const WIDTH = Number(
  process.argv.includes("--width") ? process.argv[process.argv.indexOf("--width") + 1] : 540,
);
const QUALITY = 88;
/** 목표 폭과 10% 이상 차이 나면 다시 만든다 (너무 작아도, 너무 커도). */
const TOLERANCE = 0.1;

const env = {};
for (const line of (await readFile(path.join(ROOT, ".env.local"), "utf8")).split("\n")) {
  const m = /^([A-Z_0-9]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2];
}
const STORAGE = env.STORAGE_DIR;
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 4 });

const kb = (n) => Math.round(n / 1024) + "KB";

const { rows } = await pool.query(
  `SELECT id, title, cover_key, snapshot_key FROM books
    WHERE snapshot_key IS NOT NULL ORDER BY submitted_at DESC`,
);

let improved = 0;
let skippedText = 0;
let skippedGood = 0;
let skippedNoImage = 0;

for (const b of rows) {
  // 이미 목표 폭에 가까우면 둔다.
  if (b.cover_key) {
    const md = await sharp(path.join(STORAGE, b.cover_key)).metadata().catch(() => null);
    if (md && Math.abs(md.width - WIDTH) / WIDTH <= TOLERANCE) {
      skippedGood++;
      continue;
    }
  }

  let snap;
  try {
    snap = JSON.parse(await readFile(path.join(STORAGE, b.snapshot_key), "utf8"));
  } catch {
    skippedNoImage++;
    continue;
  }
  const objects = snap?.[0]?.data?.objects ?? [];

  const realText = objects
    .filter((o) => /text/i.test(o.type ?? ""))
    .filter((o) => {
      const t = String(o.text ?? "").trim();
      return t && !PLACEHOLDER.test(t);
    });
  if (realText.length) {
    console.log(`  건너뜀(직접 쓴 글자): ${b.title} — "${String(realText[0].text).slice(0, 20)}"`);
    skippedText++;
    continue;
  }

  // 가장 큰 그림을 배경으로 본다.
  const images = objects.filter(
    (o) => o.type === "Image" && typeof o.src === "string" && o.src.startsWith("data:"),
  );
  if (!images.length) {
    skippedNoImage++;
    continue;
  }
  images.sort((a, c) => (c.width ?? 0) * (c.height ?? 0) - (a.width ?? 0) * (a.height ?? 0));
  const src = Buffer.from(images[0].src.split(",")[1], "base64");

  const before = b.cover_key
    ? await stat(path.join(STORAGE, b.cover_key)).then((s) => s.size).catch(() => 0)
    : 0;
  const beforeMd = b.cover_key
    ? await sharp(path.join(STORAGE, b.cover_key)).metadata().catch(() => null)
    : null;

  // 4:5 로 맞춘다 — 페이지 판형이 800×1000 이라 카드도 그 비율로 그려진다.
  const out = await sharp(src)
    .resize(WIDTH, Math.round((WIDTH * 5) / 4), { fit: "cover", withoutEnlargement: false })
    .jpeg({ quality: QUALITY })
    .toBuffer();

  const key = `covers/${b.id}.jpg`;
  console.log(
    `  ${APPLY ? "바꿈" : "바뀔 것"}: ${b.title} — ` +
      `${beforeMd ? beforeMd.width + "px " + kb(before) : "표지 없음"} → ${WIDTH}px ${kb(out.length)}`,
  );

  if (APPLY) {
    // 확장자가 다른 옛 파일이 남지 않게 정리하고 쓴다.
    if (b.cover_key && b.cover_key !== key) {
      await rm(path.join(STORAGE, b.cover_key), { force: true }).catch(() => {});
    }
    await writeFile(path.join(STORAGE, key), out);
    await pool.query(`UPDATE books SET cover_key = $1, cover_thumb = NULL WHERE id = $2`, [
      key,
      b.id,
    ]);
  }
  improved++;
}

console.log(
  `\n${APPLY ? "적용" : "미리보기"} — 다시 만듦 ${improved}권 · ` +
    `이미 충분 ${skippedGood}권 · 직접 쓴 글자라 보존 ${skippedText}권 · 그림 없음 ${skippedNoImage}권`,
);
if (!APPLY) console.log("실제로 바꾸려면 --apply 를 붙이세요.");
await pool.end();
