import { getServerUser } from "../../../lib/server-auth";
import {
  clearAiStudioKey,
  clearVertexServiceAccount,
  effectiveStatus,
  saveAiStudioKey,
  saveVertexServiceAccount,
  userScope,
} from "../../../lib/credentials";

/**
 * **내 자격증명** — 로그인한 사용자가 자기 것만 다룬다.
 *
 * scope 는 언제나 세션의 userId 로 만든다. 대상 사용자를 요청 본문이나 쿼리로
 * 받지 않는다 — 받는 순간 남의 키를 덮어쓰거나 지울 수 있는 통로가 된다.
 *
 * GET 은 상태 요약만 준다. 저장된 값을 다시 읽어 가는 경로는 없다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await effectiveStatus(user.id));
}

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const scope = userScope(user.id);

  let body: { kind?: string; serviceAccount?: unknown; apiKey?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  let notice: string | undefined;
  if (body.kind === "vertex") {
    const result = await saveVertexServiceAccount(scope, body.serviceAccount);
    if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  } else if (body.kind === "ai-studio") {
    const result = await saveAiStudioKey(scope, String(body.apiKey ?? ""));
    if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
    if (!result.verified) {
      notice =
        "키는 저장했지만 지금 구글에 확인할 수 없었어요. 생성이 안 되면 키를 다시 확인해 주세요.";
    }
  } else {
    return Response.json({ error: "알 수 없는 항목이에요." }, { status: 400 });
  }
  return Response.json({ ...(await effectiveStatus(user.id)), notice });
}

export async function DELETE(req: Request) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const scope = userScope(user.id);

  const kind = new URL(req.url).searchParams.get("kind");
  if (kind === "vertex") await clearVertexServiceAccount(scope);
  else if (kind === "ai-studio") await clearAiStudioKey(scope);
  else return Response.json({ error: "알 수 없는 항목이에요." }, { status: 400 });
  return Response.json(await effectiveStatus(user.id));
}
