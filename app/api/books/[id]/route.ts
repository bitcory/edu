import { type NextRequest } from "next/server";
import {
  deleteBook,
  getBookById,
  updateBookMeta,
  updateBookSnapshot,
} from "../../../lib/books-repo";
import { isApprovedAuthor } from "../../../lib/authors-repo";
import { OPEN_PUBLISH } from "../../../lib/publish-policy";
import {
  deleteNarration,
  deletePdf,
  deleteSnapshot,
  readSnapshotJson,
} from "../../../lib/pdf-storage";
import { resolvePagesFromBody } from "../../../lib/snapshot-body";
import { getServerUser } from "../../../lib/server-auth";
import type { EditorPage } from "../../../lib/editor-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const book = await getBookById(id);
  if (!book) return Response.json({ error: "not found" }, { status: 404 });
  // Editor pages live in R2 now — hydrate them so callers (reader/editor) get
  // the full snapshot just like before.
  if (book.snapshotKey && book.pages.length === 0) {
    const json = await readSnapshotJson(book.snapshotKey);
    if (json) book.pages = JSON.parse(json) as EditorPage[];
  }
  return Response.json({ book });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const existing = await getBookById(id);
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });
  if (existing.ownerId !== user.id && !user.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  // Registered works under review are locked for the owner — editable only
  // once approved. Admins can edit any book regardless of status.
  if (existing.status === "pending" && !user.isAdmin) {
    return Response.json(
      { error: "승인 대기 중에는 수정할 수 없어요. 승인 후에 수정할 수 있어요." },
      { status: 409 },
    );
  }

  const body = await req.json();
  const pages = await resolvePagesFromBody(body);

  // Metadata-only edit (no pages): title/price/description. Owner-only, keeps
  // status & content — used for PDF books and quick info edits.
  if (!Array.isArray(pages)) {
    const book = await updateBookMeta(id, {
      title: body?.title,
      author: body?.author,
      price: body?.price,
      description: body?.description,
      category: body?.category,
      coverThumb: body?.coverThumb,
    });
    return Response.json({ book });
  }

  // Snapshot re-edit (editor books): requires an approved author and sends the
  // book back to pending for re-approval.
  if (!OPEN_PUBLISH && !user.isAdmin && !(await isApprovedAuthor(user.id))) {
    return Response.json(
      { error: "작가 승인을 받아야 책을 올릴 수 있어요." },
      { status: 403 },
    );
  }
  const book = await updateBookSnapshot(id, {
    pages,
    title: body.title,
    author: body.author,
    description: body.description,
    category: body.category,
    price: body.price,
    pageW: body.pageW,
    layout: body.layout,
    coverThumb: body.coverThumb,
    storyText: body.storyText,
  });
  return Response.json({ book });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const existing = await getBookById(id);
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });
  if (existing.ownerId !== user.id && !user.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  if (existing.kind === "pdf") await deletePdf(id);
  if (existing.snapshotKey) await deleteSnapshot(existing.snapshotKey);
  for (const k of existing.narration ?? []) {
    if (k) await deleteNarration(k);
  }
  await deleteBook(id);
  return Response.json({ ok: true });
}
