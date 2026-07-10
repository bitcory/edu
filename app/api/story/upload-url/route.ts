import { getServerUser } from "../../../lib/server-auth";
import { presignStoryUpload, presignStoryDownload } from "../../../lib/pdf-storage";

/** Presign a direct browser→R2 story-image upload. Replaces the old save-image
 * route, which piped the whole image through the function as base64 — every
 * byte of that counted against Vercel Fast Origin Transfer. This response is
 * just two URLs; the bytes go browser→R2. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { contentType?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  try {
    const { key, url } = await presignStoryUpload(String(body.contentType || ""));
    const displayUrl = await presignStoryDownload(key);
    return Response.json({ key, uploadUrl: url, url: displayUrl });
  } catch {
    return Response.json({ error: "이미지 형식이 아니에요." }, { status: 400 });
  }
}
