import { type NextRequest } from "next/server";
import { getAuthor, setAuthorStatus } from "../../../../lib/authors-repo";
import { getServerUser } from "../../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getServerUser();
  if (!user?.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const author = await getAuthor(id);
  if (!author) return Response.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  await setAuthorStatus(id, "rejected", body?.reason);
  return Response.json({ ok: true });
}
