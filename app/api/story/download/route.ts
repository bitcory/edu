import { getServerUser } from "../../../lib/server-auth";
import { presignStoryDownload } from "../../../lib/pdf-storage";

/** Redirect to a presigned R2 URL that forces a download (Content-Disposition).
 * Used by the /story image lightbox "다운로드" button. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "";
  const name = (url.searchParams.get("name") || "image").replace(/[^\w.-]+/g, "_");
  if (!key.startsWith("story/")) return Response.json({ error: "invalid key" }, { status: 400 });

  try {
    const signed = await presignStoryDownload(key, 300, `${name}.png`);
    return Response.redirect(signed, 302);
  } catch (e) {
    return Response.json({ error: (e as Error)?.message || "다운로드 실패" }, { status: 500 });
  }
}
