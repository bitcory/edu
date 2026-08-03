import { getServerUser } from "../../../lib/server-auth";
import {
  clearAiStudioKey,
  clearVertexServiceAccount,
  credentialStatus,
  saveAiStudioKey,
  saveVertexServiceAccount,
} from "../../../lib/credentials";

/**
 * 외부 AI 자격증명 관리 — 관리자 전용.
 *
 * GET 은 상태 요약만 돌려준다. 저장된 서비스 계정 키나 API 키를 **다시 읽어
 * 가는 경로는 없다** — 화면에서 확인이 필요하면 지우고 다시 올리는 방식이다.
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
  return Response.json(await credentialStatus());
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

  if (body.kind === "vertex") {
    const result = await saveVertexServiceAccount(body.serviceAccount);
    if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
    return Response.json(await credentialStatus());
  }

  if (body.kind === "ai-studio") {
    const result = await saveAiStudioKey(String(body.apiKey ?? ""));
    if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
    return Response.json(await credentialStatus());
  }

  return Response.json({ error: "알 수 없는 항목이에요." }, { status: 400 });
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const kind = new URL(req.url).searchParams.get("kind");
  if (kind === "vertex") await clearVertexServiceAccount();
  else if (kind === "ai-studio") await clearAiStudioKey();
  else return Response.json({ error: "알 수 없는 항목이에요." }, { status: 400 });
  return Response.json(await credentialStatus());
}
