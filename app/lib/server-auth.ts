import { auth } from "../../auth";

export type ServerUser = {
  id: string;
  name: string;
  username: string;
  /** 로컬 계정에는 이메일이 없다. 작가 신청 시 별도로 입력받는 값만 채워진다. */
  email: string | null;
  isAdmin: boolean;
};

/**
 * Authoritative current user from the Auth.js session (server-side). Returns
 * null when not signed in. `id` is users.user_id — the value every other
 * table's owner_id / user_id column refers to.
 */
export async function getServerUser(): Promise<ServerUser | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return null;
  const username = u.username ?? "";
  const name = u.name || username || "사용자";
  return {
    id: u.id,
    name,
    username,
    email: u.email ?? null,
    isAdmin: u.isAdmin === true,
  };
}
