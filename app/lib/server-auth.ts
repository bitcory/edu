import { auth } from "../../auth";
import { isAdminEmail } from "./admin-emails";

export type ServerUser = {
  id: string;
  name: string;
  email: string | null;
  isAdmin: boolean;
};

/**
 * Authoritative current user from the Auth.js session (server-side). Returns
 * null when not signed in. `id` is the Google sub — DB rows were migrated from
 * Clerk ids by scripts/migrate-clerk-to-google.mjs.
 */
export async function getServerUser(): Promise<ServerUser | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return null;
  const email = u.email ?? null;
  const name = u.name || email?.split("@")[0] || "사용자";
  return { id: u.id, name, email, isAdmin: isAdminEmail(email) };
}
