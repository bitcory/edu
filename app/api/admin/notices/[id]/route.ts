import { updateNotice, deleteNotice } from "../../../../lib/notices-repo";
import { getServerUser } from "../../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    title?: unknown; body?: unknown; pinned?: unknown;
  } | null;
  await updateNotice(id, {
    title: typeof body?.title === "string" ? body.title : undefined,
    body: typeof body?.body === "string" ? body.body : undefined,
    pinned: typeof body?.pinned === "boolean" ? body.pinned : undefined,
  });
  return Response.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  await deleteNotice(id);
  return Response.json({ ok: true });
}
