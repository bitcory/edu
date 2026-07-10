// Clerk userId → Google sub 일회성 DB 마이그레이션 (Clerk 제거 전환용).
//
// 모든 사용자가 Google OAuth 로 가입돼 있으므로, Clerk API 에서 각 유저의
// google external account 의 provider_user_id(= Google sub)를 뽑아 6개 테이블의
// 사용자 id 컬럼을 치환한다. 이름 스냅샷 컬럼(owner_name/display_name/user_name)
// 은 커스텀 작가명 보존을 위해 절대 건드리지 않는다.
//
// Usage:
//   node --env-file=.env.local scripts/migrate-clerk-to-google.mjs            # dry-run
//   node --env-file=.env.local scripts/migrate-clerk-to-google.mjs --apply    # 적용 (journal 저장)
//   node --env-file=.env.local scripts/migrate-clerk-to-google.mjs --revert scripts/journal-<ts>.json
import { neon } from "@neondatabase/serverless";
import { writeFileSync, readFileSync } from "node:fs";

const sql = neon(process.env.DATABASE_URL);
const CLERK_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_KEY) throw new Error("CLERK_SECRET_KEY 가 없습니다 (.env.local)");

// (테이블, id 컬럼) — 이름 컬럼은 목록에 없다. 절대 추가하지 말 것.
const ID_COLUMNS = [
  ["books", "owner_id"],
  ["authors", "user_id"],
  ["likes", "user_id"],
  ["comments", "user_id"],
  ["reads", "user_id"],
  ["bgm_tracks", "owner_id"],
];

const mode = process.argv.includes("--apply")
  ? "apply"
  : process.argv.includes("--revert")
    ? "revert"
    : "dry-run";

async function fetchMapping() {
  // 사용자 14명 규모 — 한 페이지로 충분하지만 안전하게 페이지네이션.
  const map = new Map(); // clerkId → { sub, email, name }
  for (let offset = 0; ; offset += 100) {
    const r = await fetch(
      `https://api.clerk.com/v1/users?limit=100&offset=${offset}`,
      { headers: { Authorization: `Bearer ${CLERK_KEY}` } },
    );
    if (!r.ok) throw new Error(`Clerk API ${r.status}`);
    const users = await r.json();
    for (const u of users) {
      const g = (u.external_accounts || []).find(
        (e) => e.provider === "oauth_google" && e.provider_user_id,
      );
      map.set(u.id, {
        sub: g ? String(g.provider_user_id) : null,
        email: u.email_addresses?.[0]?.email_address || null,
        name: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || null,
      });
    }
    if (users.length < 100) break;
  }
  return map;
}

async function distinctIds() {
  const ids = new Set();
  for (const [table, col] of ID_COLUMNS) {
    const rows = await sql.query(`SELECT DISTINCT ${col} AS id FROM ${table}`);
    rows.forEach((r) => r.id && ids.add(String(r.id)));
  }
  return ids;
}

async function countRows(col, table, id) {
  const r = await sql.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${col} = $1`, [id]);
  return r[0].n;
}

async function main() {
  if (mode === "revert") {
    const path = process.argv[process.argv.indexOf("--revert") + 1];
    const journal = JSON.parse(readFileSync(path, "utf8"));
    for (const { clerkId, sub } of journal.applied) {
      for (const [table, col] of ID_COLUMNS) {
        await sql.query(`UPDATE ${table} SET ${col} = $1 WHERE ${col} = $2`, [clerkId, sub]);
      }
      console.log(`복원: ${sub} → ${clerkId}`);
    }
    console.log("revert 완료");
    return;
  }

  const map = await fetchMapping();
  console.log(`Clerk 사용자 ${map.size}명 조회`);

  const noSub = [...map.entries()].filter(([, v]) => !v.sub);
  if (noSub.length) {
    console.error("⚠️ Google 계정이 없는 사용자 — 중단합니다:");
    noSub.forEach(([id, v]) => console.error(`  ${id} ${v.email}`));
    process.exit(1);
  }

  const dbIds = await distinctIds();
  const clerkIdsInDb = [...dbIds].filter((id) => id.startsWith("user_"));
  const orphans = clerkIdsInDb.filter((id) => !map.has(id));
  const toMigrate = clerkIdsInDb.filter((id) => map.has(id));
  const alreadyMigrated = [...dbIds].filter((id) => !id.startsWith("user_"));

  console.log(`\nDB의 사용자 id: 총 ${dbIds.size}종 — Clerk형 ${clerkIdsInDb.length}, 비Clerk형(이미 sub?) ${alreadyMigrated.length}`);
  if (orphans.length) {
    console.log(`\n⚠️ orphan (Clerk에 없는 id — 그대로 보존, 스킵): ${orphans.length}종`);
    orphans.forEach((id) => console.log(`  ${id}`));
  }

  console.log("\n=== 매핑 표 (영향 행 수) ===");
  const plan = [];
  for (const clerkId of toMigrate) {
    const { sub, email, name } = map.get(clerkId);
    const counts = {};
    for (const [table, col] of ID_COLUMNS) {
      const n = await countRows(col, table, clerkId);
      if (n) counts[table] = n;
    }
    plan.push({ clerkId, sub, email, name, counts });
    console.log(`${email} (${name}) — ${clerkId} → ${sub}`);
    console.log(`   ${Object.entries(counts).map(([t, n]) => `${t}:${n}`).join("  ") || "(행 없음)"}`);
  }

  // 컷오버 전 새 구글 세션이 이미 만든 sub 행(authors 등) — apply 가 지우고
  // Clerk 원본을 승계한다. dry-run 에서 미리 보여준다.
  for (const { clerkId, sub, email } of plan) {
    const dup = await sql.query(
      `SELECT display_name FROM authors WHERE user_id = $1`,
      [sub],
    );
    if (dup.length) {
      const orig = await sql.query(
        `SELECT display_name FROM authors WHERE user_id = $1`,
        [clerkId],
      );
      console.log(
        `⚠️ ${email}: sub 로 자동 생성된 authors 행 발견("${dup[0].display_name}") — apply 시 삭제하고 원본("${orig[0]?.display_name}") 승계`,
      );
    }
  }

  if (mode !== "apply") {
    console.log("\n(dry-run — 변경 없음. 적용하려면 --apply)");
    return;
  }

  // journal 먼저 저장 — 롤백의 생명줄.
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const journalPath = `scripts/journal-${ts}.json`;
  writeFileSync(journalPath, JSON.stringify({ ts, applied: plan }, null, 2));
  console.log(`\njournal 저장: ${journalPath}`);

  // Neon HTTP 드라이버 비대화형 트랜잭션 — 쿼리는 await 없이 만들어 배열로 넘긴다
  // (neon()의 쿼리는 lazy — transaction 이 한 번에 실행).
  //
  // PK 충돌 방어: 컷오버 전에 새 구글 세션으로 접속한 사용자는 authors(PK
  // user_id) 등에 sub 로 된 행이 자동 생성돼 있을 수 있다 (예: /library 방문이
  // ensureApprovedAuthor 를 태움). 이 행들은 방금 만들어진 빈 껍데기고, Clerk
  // 시절 행이 커스텀 작가명·상태의 원본이므로 sub 행을 지우고 원본을 승계한다.
  // likes/reads 는 (book, user[, period]) 복합 PK — 같은 책에 양쪽 id 행이 다
  // 있으면 sub 쪽(신규)을 지워 UPDATE 충돌을 막는다.
  const queries = [];
  for (const { clerkId, sub } of plan) {
    queries.push(
      sql.query(
        `DELETE FROM authors WHERE user_id = $1
           AND EXISTS (SELECT 1 FROM authors WHERE user_id = $2)`,
        [sub, clerkId],
      ),
      sql.query(
        `DELETE FROM likes l WHERE l.user_id = $1
           AND EXISTS (SELECT 1 FROM likes x WHERE x.user_id = $2 AND x.book_id = l.book_id)`,
        [sub, clerkId],
      ),
      sql.query(
        `DELETE FROM reads r WHERE r.user_id = $1
           AND EXISTS (SELECT 1 FROM reads x WHERE x.user_id = $2 AND x.book_id = r.book_id AND x.period = r.period)`,
        [sub, clerkId],
      ),
    );
    for (const [table, col] of ID_COLUMNS) {
      queries.push(sql.query(`UPDATE ${table} SET ${col} = $1 WHERE ${col} = $2`, [sub, clerkId]));
    }
  }
  await sql.transaction(queries);

  // 사후 검증: orphan 외에 user_ 형 id 가 남아 있으면 안 된다.
  const after = await distinctIds();
  const remaining = [...after].filter((id) => id.startsWith("user_") && !orphans.includes(id));
  console.log(`\n적용 완료. 남은 user_ 형 id (orphan 제외): ${remaining.length}`);
  if (remaining.length) {
    console.error("⚠️ 잔여 발견 — 확인 필요:", remaining);
    process.exit(1);
  }
  console.log("✅ 마이그레이션 성공");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
