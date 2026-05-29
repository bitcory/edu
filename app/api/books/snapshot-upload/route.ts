import { presignSnapshotUpload } from "../../../lib/pdf-storage";
import { getServerUser } from "../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hand the client a presigned R2 URL to upload a large editor snapshot to,
// bypassing the serverless request-body limit. Returns the temp key to send
// back with the save request (draft/submit/update read it server-side).
export async function POST() {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { key, url } = await presignSnapshotUpload();
  return Response.json({ key, url });
}
