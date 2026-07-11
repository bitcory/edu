import { listFeatured, upsertFeatured } from "../../../lib/featured-repo";
import { getServerUser } from "../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getServerUser();
  if (!user?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });
  return Response.json({ featured: await listFeatured() });
}

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    bookId?: unknown; note?: unknown; sort?: unknown;
  } | null;
  const bookId = typeof body?.bookId === "string" ? body.bookId : "";
  if (!bookId) return Response.json({ error: "bookId required" }, { status: 400 });

  await upsertFeatured(
    bookId,
    typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null,
    typeof body?.sort === "number" ? body.sort : 0,
  );
  return Response.json({ ok: true });
}
