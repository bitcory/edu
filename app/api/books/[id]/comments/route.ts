import { type NextRequest } from "next/server";
import {
  addComment,
  deleteComment,
  getComment,
} from "../../../../lib/social-repo";
import { getServerUser } from "../../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Add a comment to a book.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) {
    return Response.json({ error: "댓글을 입력해 주세요." }, { status: 400 });
  }
  const comment = await addComment(id, { id: user.id, name: user.name }, text);
  return Response.json({ comment }, { status: 201 });
}

// Delete a comment (its author or an admin).
export async function DELETE(
  req: NextRequest,
  _ctx: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const commentId = typeof body?.commentId === "string" ? body.commentId : "";
  const comment = await getComment(commentId);
  if (!comment) return Response.json({ error: "not found" }, { status: 404 });
  if (comment.userId !== user.id && !user.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  await deleteComment(commentId);
  return Response.json({ ok: true });
}
