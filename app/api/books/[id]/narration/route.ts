import { type NextRequest } from "next/server";
import { getBookById, setBookNarration } from "../../../../lib/books-repo";
import {
  deleteNarration,
  narrationKeyFor,
  presignNarrationUpload,
} from "../../../../lib/pdf-storage";
import { getServerUser } from "../../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function widen(arr: (string | null)[] | undefined, index: number) {
  const out = [...(arr ?? [])];
  while (out.length <= index) out.push(null);
  return out;
}

// Attach a page's narration: returns a presigned PUT URL and records the R2 key
// at that page index. Owner/admin only.
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

  const body = (await req.json().catch(() => null)) as { index?: unknown } | null;
  const index = typeof body?.index === "number" ? body.index : -1;
  if (index < 0) return Response.json({ error: "index required" }, { status: 400 });

  const { key, url } = await presignNarrationUpload(id, index);
  const narration = widen(book.narration, index);
  narration[index] = key;
  await setBookNarration(id, narration);
  return Response.json({ uploadUrl: url });
}

// Remove a page's narration. Owner/admin only.
export async function DELETE(
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

  const index = Number(req.nextUrl.searchParams.get("index") ?? -1);
  if (!Number.isInteger(index) || index < 0) {
    return Response.json({ error: "index required" }, { status: 400 });
  }

  const narration = widen(book.narration, index);
  await deleteNarration(narration[index] ?? narrationKeyFor(id, index));
  narration[index] = null;
  await setBookNarration(id, narration);
  return Response.json({ ok: true });
}
