import { type NextRequest } from "next/server";
import { getBookById, setBookAudio } from "../../../../lib/books-repo";
import {
  deleteAudio,
  presignAudioUpload,
} from "../../../../lib/pdf-storage";
import { getServerUser } from "../../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Attach background music: returns a presigned PUT URL for the browser to
// upload the MP3 and records the key on the book. Owner/admin only.
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const book = await getBookById(id);
  if (!book) return Response.json({ error: "not found" }, { status: 404 });
  if (book.ownerId !== user.id && !user.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { key, url } = await presignAudioUpload(id);
  await setBookAudio(id, key);
  return Response.json({ uploadUrl: url });
}

// Remove background music. Owner/admin only.
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const book = await getBookById(id);
  if (!book) return Response.json({ error: "not found" }, { status: 404 });
  if (book.ownerId !== user.id && !user.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await setBookAudio(id, null);
  await deleteAudio(id);
  return Response.json({ ok: true });
}
