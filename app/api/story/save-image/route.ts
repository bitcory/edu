import { getServerUser } from "../../../lib/server-auth";
import { saveStoryImageFromDataUrl, presignStoryDownload } from "../../../lib/pdf-storage";

/** Upload a generated/uploaded story image (data URL) to R2, return its key + a
 * presigned display URL. The page stores only the small key (in the lib JSON /
 * localStorage); image bytes live in R2. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { dataUrl?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.dataUrl) return Response.json({ error: "dataUrl 누락" }, { status: 400 });

  try {
    const key = await saveStoryImageFromDataUrl(body.dataUrl);
    if (!key) return Response.json({ error: "이미지 데이터 URL이 아니에요." }, { status: 400 });
    const url = await presignStoryDownload(key);
    return Response.json({ key, url });
  } catch (e) {
    return Response.json({ error: (e as Error)?.message || "저장 실패" }, { status: 500 });
  }
}
