/**
 * Launch-phase publishing policy.
 *
 * OPEN_PUBLISH = true (current): open marketplace. Any logged-in member can
 * publish freely — no author approval, no admin review — and submissions go
 * straight to the public store (status `approved`). Zero moderation up front;
 * admins can still reject/delete after the fact.
 *
 * Flip to false to restore the curated workflow: editor books require an
 * approved author and land in `pending` for admin review; PDF uploads become
 * private `draft`s in the owner's library only.
 */
export const OPEN_PUBLISH = true;

/** Initial status for a newly submitted editor book. */
export function initialEditorStatus(): "approved" | "pending" {
  return OPEN_PUBLISH ? "approved" : "pending";
}

/** Initial status for a freshly uploaded PDF book. */
export function initialPdfStatus(): "approved" | "draft" {
  return OPEN_PUBLISH ? "approved" : "draft";
}
