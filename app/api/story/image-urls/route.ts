import { getServerUser } from "../../../lib/server-auth";
import { presignStoryDownload } from "../../../lib/pdf-storage";

/** Re-presign story image keys for display (presigned URLs expire ~1h, so the
 * page calls this on load to refresh URLs for keys stored in its lib JSON). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { keys?: string[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const keys = Array.isArray(body.keys) ? body.keys.filter((k) => typeof k === "string") : [];
  const urls: Record<string, string> = {};
  await Promise.all(
    keys.map(async (key) => {
      try {
        urls[key] = await presignStoryDownload(key);
      } catch {
        /* skip invalid/missing keys */
      }
    }),
  );
  return Response.json({ urls });
}
