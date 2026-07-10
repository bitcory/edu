"use client";

import { useSession } from "next-auth/react";
import { isAdminEmail } from "../../lib/admin-emails";

/** Client-side admin check for showing/hiding admin UI. The server re-checks
 * authoritatively (see app/lib/server-auth.ts) — this is only for the UI. */
export function useIsAdmin(): { isAdmin: boolean; isLoaded: boolean } {
  const { data: session, status } = useSession();
  return {
    isAdmin: isAdminEmail(session?.user?.email ?? undefined),
    isLoaded: status !== "loading",
  };
}
