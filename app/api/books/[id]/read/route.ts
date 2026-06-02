import { type NextRequest } from "next/server";
import { getServerUser } from "../../../../lib/server-auth";
import { getBookById } from "../../../../lib/books-repo";
import { recordRead } from "../../../../lib/settlement-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Record a "read" for the monthly author settlement. Counted only for a
// logged-in reader of a *published* book that isn't their own; deduped per
// (book, reader, month) at the DB. Fire-and-forget from the client.
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getServerUser();
  // Anonymous reads can't be deduped per reader — ignore quietly.
  if (!user) return Response.json({ ok: false });
  const book = await getBookById(id);
  if (book && book.status === "approved" && book.ownerId !== user.id) {
    await recordRead(id, user.id);
  }
  return Response.json({ ok: true });
}
