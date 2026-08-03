import { getServerUser } from "../../../lib/server-auth";
import {
  SERVER_SCOPE,
  clearAiStudioKey,
  clearVertexServiceAccount,
  credentialStatus,
  saveAiStudioKey,
  saveVertexServiceAccount,
} from "../../../lib/credentials";

/**
 * **서버 기본값** 자격증명 — 관리자 전용.
 *
 * 개인 키가 없는 사용자에게만 폴백으로 쓰인다. 각 사용자의 키는 여기서 보거나
 * 바꿀 수 없다 — /api/settings/credentials 가 요청자 본인 것만 다룬다.
 *
 * GET 은 상태 요약만 돌려준다. 저장된 값을 다시 읽어 가는 경로는 없다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getServerUser();
  return user?.isAdmin ? user : null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return Response.json(await credentialStatus(SERVER_SCOPE));
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { kind?: string; serviceAccount?: unknown; apiKey?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  let notice: string | undefined;
  if (body.kind === "vertex") {
    const result = await saveVertexServiceAccount(SERVER_SCOPE, body.serviceAccount);
    if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  } else if (body.kind === "ai-studio") {
    const result = await saveAiStudioKey(SERVER_SCOPE, String(body.apiKey ?? ""));
    if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
    if (!result.verified) {
      notice =
        "키는 저장했지만 지금 구글에 확인할 수 없었어요. 생성이 안 되면 키를 다시 확인해 주세요.";
    }
  } else {
    return Response.json({ error: "알 수 없는 항목이에요." }, { status: 400 });
  }
  return Response.json({ ...(await credentialStatus(SERVER_SCOPE)), notice });
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const kind = new URL(req.url).searchParams.get("kind");
  if (kind === "vertex") await clearVertexServiceAccount(SERVER_SCOPE);
  else if (kind === "ai-studio") await clearAiStudioKey(SERVER_SCOPE);
  else return Response.json({ error: "알 수 없는 항목이에요." }, { status: 400 });
  return Response.json(await credentialStatus(SERVER_SCOPE));
}
