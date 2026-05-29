import { type NextRequest } from "next/server";
import { getBookById } from "../../../../lib/books-repo";
import { presignAudioDownload } from "../../../../lib/pdf-storage";
import { getServerUser } from "../../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Presigned URL to stream a book's background music in an <audio> element.
// Readable for approved books (any member) or by the owner/admin otherwise.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const book = await getBookById(id);
  if (!book || !book.audioKey) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  if (book.status !== "approved" && book.ownerId !== user.id && !user.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const url = await presignAudioDownload(book.audioKey);
  return Response.json({ url });
}
