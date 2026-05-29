import { readSnapshotJson, deleteSnapshot } from "./pdf-storage";

/**
 * Resolve the editor pages from a write request body. Small snapshots arrive
 * inline as `pages`; large ones are uploaded to R2 (to dodge the serverless
 * request-body limit) and referenced by `snapshotKey` — read them back here
 * and clean up the temp object. Server-only.
 */
export async function resolvePagesFromBody(body: {
  pages?: unknown;
  snapshotKey?: unknown;
}): Promise<unknown> {
  if (typeof body?.snapshotKey === "string") {
    const json = await readSnapshotJson(body.snapshotKey);
    await deleteSnapshot(body.snapshotKey);
    return json ? JSON.parse(json) : null;
  }
  return body?.pages;
}
