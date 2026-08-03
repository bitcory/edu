"use client";

import { useSession } from "next-auth/react";

/** Client-side admin check for showing/hiding admin UI. The server re-checks
 * authoritatively (see app/lib/server-auth.ts) — this is only for the UI.
 * auth.ts puts the flag on the session from users.is_admin. */
export function useIsAdmin(): { isAdmin: boolean; isLoaded: boolean } {
  const { data: session, status } = useSession();
  return {
    isAdmin: session?.user?.isAdmin === true,
    isLoaded: status !== "loading",
  };
}
