import { currentUser } from "@clerk/nextjs/server";
import { isAdminEmail } from "./admin-emails";

export type ServerUser = {
  id: string;
  name: string;
  email: string | null;
  isAdmin: boolean;
};

/**
 * Authoritative current user from the Clerk session (server-side). Returns null
 * when not signed in. Replaces the old `x-mock-user` header trust.
 */
export async function getServerUser(): Promise<ServerUser | null> {
  const u = await currentUser();
  if (!u) return null;
  const email = u.primaryEmailAddress?.emailAddress ?? null;
  const name =
    u.firstName ||
    u.username ||
    u.fullName ||
    email?.split("@")[0] ||
    "사용자";
  return { id: u.id, name, email, isAdmin: isAdminEmail(email) };
}
