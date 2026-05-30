import { type NextRequest } from "next/server";
import { deleteBgmTrack, getBgmTrack } from "../../../lib/bgm-repo";
import { deleteBgm } from "../../../lib/pdf-storage";
import { getServerUser } from "../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Remove a pool track. The uploader or an admin can delete it.
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const track = await getBgmTrack(id);
  if (!track) return Response.json({ error: "not found" }, { status: 404 });
  if (track.ownerId !== user.id && !user.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await deleteBgmTrack(id);
  await deleteBgm(track.key);
  return Response.json({ ok: true });
}
