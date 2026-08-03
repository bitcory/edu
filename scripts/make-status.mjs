// 「그림책 만들기」 그림이 몇 장 채워졌는지 점검한다.
//
//   node --experimental-strip-types scripts/make-status.mjs          요약
//   node --experimental-strip-types scripts/make-status.mjs --missing 빠진 것 전부 나열
//
// 328장을 손으로 채우는 동안 어디까지 했는지 보려고 만든 것.

import { stat } from "node:fs/promises";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ACTIONS,
  CHARACTERS,
  LOCATIONS,
  PAGES_PER_BOOK,
  allImagePaths,
  comboId,
} from "../app/lib/make-catalog.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

// STORAGE_DIR 은 .env.local 에 있다 (Next 가 읽는 파일 — 여기서도 같은 값을 쓴다).
function storageDir() {
  if (process.env.STORAGE_DIR) return process.env.STORAGE_DIR;
  try {
    const env = readFileSync(path.join(ROOT, ".env.local"), "utf8");
    const m = /^STORAGE_DIR=(.*)$/m.exec(env);
    if (m) return m[1].trim();
  } catch {
    /* 무시 */
  }
  return null;
}

const root = storageDir();
if (!root) {
  console.error("STORAGE_DIR 을 찾지 못했어요 (.env.local 확인).");
  process.exit(1);
}

async function exists(rel) {
  for (const ext of EXTENSIONS) {
    try {
      const s = await stat(path.join(root, "make", `${rel}${ext}`));
      if (s.isFile()) return true;
    } catch {
      /* 다음 확장자 */
    }
  }
  return false;
}

const all = allImagePaths();
const missing = [];
for (const rel of all) {
  if (!(await exists(rel))) missing.push(rel);
}

const done = all.length - missing.length;
const pct = Math.round((done / all.length) * 100);
console.log(`\n그림 ${done} / ${all.length} 장 (${pct}%)  —  ${path.join(root, "make")}\n`);

// 조합 단위로 몇 권이 완성됐는지 — 완성된 조합만 아이에게 온전히 보인다.
let readyBooks = 0;
const partial = [];
for (const c of CHARACTERS) {
  for (const a of ACTIONS) {
    for (const l of LOCATIONS) {
      const folder = comboId(c.id, a.id, l.id);
      let have = 0;
      for (let p = 1; p <= PAGES_PER_BOOK; p++) {
        if (!missing.includes(`scenes/${folder}/${p}`)) have++;
      }
      if (have === PAGES_PER_BOOK) readyBooks++;
      else if (have > 0) partial.push(`${folder} (${have}/${PAGES_PER_BOOK})`);
    }
  }
}
const totalBooks = CHARACTERS.length * ACTIONS.length * LOCATIONS.length;
console.log(`완성된 책: ${readyBooks} / ${totalBooks} 권`);
if (partial.length) {
  console.log(`\n만들다 만 조합 ${partial.length}개:`);
  for (const p of partial) console.log(`  ${p}`);
}

if (process.argv.includes("--missing")) {
  console.log(`\n빠진 그림 ${missing.length}장:`);
  for (const m of missing) console.log(`  make/${m}.png`);
} else if (missing.length) {
  console.log(`\n빠진 그림 ${missing.length}장 — 전체 목록은 --missing 옵션으로.`);
}
console.log();
