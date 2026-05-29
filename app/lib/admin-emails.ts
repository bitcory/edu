// Super-admin emails (can approve/reject in /admin). Matched against the
// signed-in Google account's email. Add/replace with the real owner email(s).
// Later this could move to an env var or Clerk user metadata.
export const ADMIN_EMAILS = ["ggamsire@gmail.com"];

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
