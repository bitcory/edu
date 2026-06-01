import { type NextRequest } from "next/server";
import { getBookById, setBookAudio } from "../../../../../lib/books-repo";
import { getBgmTrack } from "../../../../../lib/bgm-repo";
import { getServerUser } from "../../../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Use a shared-pool track as a book's background music — WITHOUT copying the
// MP3. The book simply references the pool object's R2 key (bgm/<trackId>.mp3),
// so no extra storage is used and no bytes move through the server or Neon.
// Owner/admin only.
export async function POST(
  req: NextRequest,
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

  const body = (await req.json().catch(() => null)) as {
    trackId?: unknown;
  } | null;
  const trackId = typeof body?.trackId === "string" ? body.trackId : null;
  if (!trackId) {
    return Response.json({ error: "trackId required" }, { status: 400 });
  }

  const track = await getBgmTrack(trackId);
  if (!track) {
    return Response.json({ error: "track not found" }, { status: 404 });
  }

  await setBookAudio(id, track.key);
  return Response.json({ ok: true });
}
