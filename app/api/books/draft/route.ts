import { type NextRequest } from "next/server";
import {
  getBookById,
  insertBook,
  updateBookSnapshot,
} from "../../../lib/books-repo";
import { getServerUser } from "../../../lib/server-auth";
import { resolveUserName } from "../../../lib/user-name";
import { resolvePagesFromBody } from "../../../lib/snapshot-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 임시저장: save the in-progress editor book WITHOUT publishing. Any logged-in
// member may save their own drafts (private). New books are created as 'draft';
// re-saving keeps the book's current status (a draft stays a draft, a published
// book stays published — editing in place). Pending books are locked.
export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const pages = await resolvePagesFromBody(body);
  if (!Array.isArray(pages)) {
    return Response.json({ error: "pages required" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : null;

  if (id) {
    const existing = await getBookById(id);
    if (existing) {
      if (existing.ownerId !== user.id && !user.isAdmin) {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
      if (existing.status === "pending") {
        return Response.json(
          { error: "승인 대기 중에는 저장할 수 없어요." },
          { status: 409 },
        );
      }
      // A book that already has content must never be overwritten by an empty
      // save — that's a broken editor session (failed page load), not intent.
      if (pages.length === 0 && (existing.pageCount ?? 0) > 0) {
        return Response.json(
          { error: "책 내용이 비어 있어 저장하지 않았어요. 페이지를 다시 불러온 뒤 저장해 주세요." },
          { status: 409 },
        );
      }
      const book = await updateBookSnapshot(
        id,
        {
          pages,
          title: body.title,
          description: body.description,
          price: body.price,
          pageW: body.pageW,
          layout: body.layout,
          storyText: body.storyText,
        },
        existing.status, // keep current state — never auto-publish on 임시저장
      );
      return Response.json({ book });
    }
    // The editor holds a draft id that isn't in the DB (e.g. the row was
    // deleted, or the DB was reset). Recreate it WITH THAT id instead of 404'ing
    // so the editor's saved draftId stays valid and narration/bgm keep working.
    const recreated = await insertBook(
      {
        title: body.title ?? "",
        author: body.author,
        description: body.description,
        price: body.price,
        pageW: body.pageW,
        layout: body.layout,
        pages,
        storyText: body.storyText,
      },
      { id: user.id, name: await resolveUserName(user) },
      "draft",
      id,
    );
    return Response.json({ book: recreated }, { status: 201 });
  }

  const book = await insertBook(
    {
      title: body.title ?? "",
      author: body.author,
      description: body.description,
      price: body.price,
      pageW: body.pageW,
      layout: body.layout,
      pages,
      storyText: body.storyText,
    },
    { id: user.id, name: await resolveUserName(user) },
    "draft",
  );
  return Response.json({ book }, { status: 201 });
}
