import { removeFeatured } from "../../../../lib/featured-repo";
import { getServerUser } from "../../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ bookId: string }> },
) {
  const user = await getServerUser();
  if (!user?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });
  const { bookId } = await ctx.params;
  await removeFeatured(bookId);
  return Response.json({ ok: true });
}
