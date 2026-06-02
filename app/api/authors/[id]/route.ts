import { type NextRequest } from "next/server";
import { getPublicAuthor } from "../../../lib/authors-repo";
import { listAuthorBooks } from "../../../lib/books-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public author profile: PII-free author info + their approved books, most
// liked first. No auth required — only approved authors / approved books are
// exposed. (The admin author list at /api/authors stays admin-only.)
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const author = await getPublicAuthor(id);
  if (!author) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const books = await listAuthorBooks(id);
  return Response.json({ author, books });
}
