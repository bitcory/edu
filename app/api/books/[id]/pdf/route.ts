import { type NextRequest } from "next/server";
import { getBookById } from "../../../../lib/books-repo";
import { readPdf } from "../../../../lib/pdf-storage";
import { getServerUser } from "../../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const book = await getBookById(id);
  if (!book || book.kind !== "pdf") {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  // Approved books are readable by any member; otherwise owner/admin only.
  if (book.status !== "approved" && book.ownerId !== user.id && !user.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const bytes = await readPdf(id);
  if (!bytes) return Response.json({ error: "not found" }, { status: 404 });

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "cache-control": "private, no-store",
    },
  });
}
