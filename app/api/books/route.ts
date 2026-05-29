import { type NextRequest } from "next/server";
import { insertBook, listBooks } from "../../lib/books-repo";
import { isApprovedAuthor } from "../../lib/authors-repo";
import { OPEN_PUBLISH } from "../../lib/publish-policy";
import { getServerUser } from "../../lib/server-auth";
import { resolvePagesFromBody } from "../../lib/snapshot-body";
import type { BookScope } from "../../lib/book-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("scope") ?? "store";
  const scope = (["store", "mine", "pending", "rejected"].includes(raw)
    ? raw
    : "store") as BookScope;
  const user = await getServerUser();

  if ((scope === "pending" || scope === "rejected") && !user?.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const books = await listBooks(scope, user?.id);
  return Response.json({ books });
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!OPEN_PUBLISH && !user.isAdmin && !(await isApprovedAuthor(user.id))) {
    return Response.json(
      { error: "작가 승인을 받아야 책을 올릴 수 있어요." },
      { status: 403 },
    );
  }

  const body = await req.json();
  const pages = await resolvePagesFromBody(body);
  if (!Array.isArray(pages)) {
    return Response.json({ error: "pages required" }, { status: 400 });
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
    },
    { id: user.id, name: user.name },
  );
  return Response.json({ book }, { status: 201 });
}
