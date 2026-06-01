import { type NextRequest } from "next/server";
import { getBookById } from "../../../../lib/books-repo";
import { presignNarrationDownload } from "../../../../lib/pdf-storage";
import { getServerUser } from "../../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Presigned URLs to stream each page's narration in the reader. Returns an
// array aligned to page index (null where a page has no narration).
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const book = await getBookById(id);
  if (!book) return Response.json({ error: "not found" }, { status: 404 });
  if (book.status !== "approved" && book.ownerId !== user.id && !user.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const keys = book.narration ?? [];
  const urls = await Promise.all(
    keys.map((k) => (k ? presignNarrationDownload(k) : Promise.resolve(null))),
  );
  return Response.json({ urls });
}
