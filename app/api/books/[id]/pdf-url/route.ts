import { type NextRequest } from "next/server";
import { getBookById } from "../../../../lib/books-repo";
import { presignPdfDownload } from "../../../../lib/pdf-storage";
import { getServerUser } from "../../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Presigned URL to download a PDF straight from R2 (faster than proxying the
// bytes through the function). Same access rules as the proxy route.
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
  if (book.status !== "approved" && book.ownerId !== user.id && !user.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const url = await presignPdfDownload(id);
  return Response.json({ url });
}
