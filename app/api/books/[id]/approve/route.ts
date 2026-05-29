import { type NextRequest } from "next/server";
import { getBookById, setBookStatus } from "../../../../lib/books-repo";
import { getServerUser } from "../../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getServerUser();
  if (!user?.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const existing = await getBookById(id);
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });

  await setBookStatus(id, "approved");
  return Response.json({ ok: true });
}
