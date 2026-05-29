"use client";

import { useUser } from "@clerk/nextjs";
import { isAdminEmail } from "../../lib/admin-emails";

/** Client-side admin check for showing/hiding admin UI. The server re-checks
 * authoritatively (see app/lib/server-auth.ts) — this is only for the UI. */
export function useIsAdmin(): { isAdmin: boolean; isLoaded: boolean } {
  const { user, isLoaded } = useUser();
  return {
    isAdmin: isAdminEmail(user?.primaryEmailAddress?.emailAddress),
    isLoaded,
  };
}
