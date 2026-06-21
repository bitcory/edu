import { type NextRequest } from "next/server";
import { getServerUser } from "../../../../lib/server-auth";
import { getBookById, incrementView } from "../../../../lib/books-repo";
import { recordRead } from "../../../../lib/settlement-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bump the public 조회수 for every open, then record a settlement "read" (only
// for a logged-in reader of a *published* book that isn't their own; deduped per
// (book, reader, month) at the DB). Fire-and-forget from the client.
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  // 조회수: count every open (incl. anonymous). Guarded to approved books in the query.
  await incrementView(id).catch(() => {});
  const user = await getServerUser();
  if (!user) return Response.json({ ok: true });
  const book = await getBookById(id);
  if (book && book.status === "approved" && book.ownerId !== user.id) {
    await recordRead(id, user.id);
  }
  return Response.json({ ok: true });
}
