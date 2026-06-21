import { type NextRequest } from "next/server";
import { getServerUser } from "../../../../lib/server-auth";
import { getBookById } from "../../../../lib/books-repo";
import { recordRead } from "../../../../lib/settlement-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Record a "read" — used for both the monthly author settlement AND the store
// 조회수 (which counts rows in `reads`). Counted only for a logged-in reader of a
// *published* book that isn't their own; deduped per (book, reader, month).
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getServerUser();
  if (!user) return Response.json({ ok: false });
  const book = await getBookById(id);
  if (book && book.status === "approved" && book.ownerId !== user.id) {
    await recordRead(id, user.id);
  }
  return Response.json({ ok: true });
}
