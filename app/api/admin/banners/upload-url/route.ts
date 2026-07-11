import { presignBannerUpload } from "../../../../lib/pdf-storage";
import { getServerUser } from "../../../../lib/server-auth";

/** 배너 이미지 presigned PUT — 브라우저가 R2 로 직접 업로드 (admin 전용). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { contentType?: unknown } | null;
  try {
    const { key, url } = await presignBannerUpload(String(body?.contentType || ""));
    return Response.json({ key, uploadUrl: url });
  } catch {
    return Response.json({ error: "이미지 형식이 아니에요." }, { status: 400 });
  }
}
