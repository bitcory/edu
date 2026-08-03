import { getServerUser } from "../../../lib/server-auth";
import { getImageModel, setImageModel } from "../../../lib/users-repo";

/**
 * 개인 설정 — 지금은 이미지 생성 모델 하나.
 *
 * 자격증명과 같은 원칙: 대상 사용자를 파라미터로 받지 않고 세션의 userId 로만
 * 동작한다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ imageModel: await getImageModel(user.id) });
}

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { imageModel?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const saved = await setImageModel(user.id, String(body.imageModel ?? ""));
  return Response.json({ imageModel: saved });
}
