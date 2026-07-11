import { listNotices, insertNotice } from "../../../lib/notices-repo";
import { getServerUser } from "../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getServerUser();
  if (!user?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });
  return Response.json({ notices: await listNotices() });
}

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    title?: unknown; body?: unknown; pinned?: unknown;
  } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const text = typeof body?.body === "string" ? body.body : "";
  if (!title) return Response.json({ error: "title required" }, { status: 400 });

  const notice = await insertNotice({ title, body: text, pinned: !!body?.pinned });
  return Response.json({ notice }, { status: 201 });
}
