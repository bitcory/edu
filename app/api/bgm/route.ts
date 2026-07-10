import { type NextRequest } from "next/server";
import { insertBgmTrack, listBgmTracks } from "../../lib/bgm-repo";
import { presignBgmDownload, presignBgmUpload } from "../../lib/pdf-storage";
import { getServerUser } from "../../lib/server-auth";
import { resolveUserName } from "../../lib/user-name";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// List the shared BGM pool with presigned stream URLs. Any member can read it
// (the reader picks one at random when a book has no music of its own).
export async function GET() {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const rows = await listBgmTracks();
  const tracks = await Promise.all(
    rows.map(async (t) => ({
      id: t.id,
      name: t.name,
      ownerId: t.ownerId,
      ownerName: t.ownerName,
      key: t.key,
      url: await presignBgmDownload(t.key),
    })),
  );
  return Response.json({ tracks });
}

// Add a track to the pool: create the row + hand back a presigned PUT URL so
// the browser uploads the MP3 straight to R2 (bypassing the body limit).
export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name : "배경음악";

  // Row's key is bgm/<id>.mp3; presignBgmUpload(id) targets the same key.
  const track = await insertBgmTrack(
    { name },
    { id: user.id, name: await resolveUserName(user) },
  );
  const { url } = await presignBgmUpload(track.id);
  return Response.json({ track, uploadUrl: url }, { status: 201 });
}
