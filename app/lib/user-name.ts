import { db, ensureSchema } from "./db";
import type { ServerUser } from "./server-auth";

/**
 * 콘텐츠에 기록할 사용자 이름. 작가 프로필(authors.display_name)에 커스텀
 * 작가명이 있으면 그것을, 없으면 세션(구글 프로필) 이름을 쓴다. Clerk 시절에는
 * 프로필 이름 자체를 바꿔서(user.update) 세션 이름 = 작가명이었지만, 구글
 * 로그인은 프로필을 못 바꾸므로 DB 가 커스텀 이름의 원천이다.
 * 이름을 DB에 *쓰는* 라우트에서만 호출할 것 (읽기 라우트에는 불필요).
 */
export async function resolveUserName(user: ServerUser): Promise<string> {
  await ensureSchema();
  try {
    const r = await db.execute({
      sql: `SELECT display_name FROM authors WHERE user_id = ?`,
      args: [user.id],
    });
    const custom = r.rows[0]?.display_name;
    if (typeof custom === "string" && custom.trim()) return custom;
  } catch {
    /* authors 조회 실패 시 세션 이름으로 */
  }
  return user.name;
}
