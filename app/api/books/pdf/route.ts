import { type NextRequest } from "next/server";
import { insertPdfBook } from "../../../lib/books-repo";
import { presignPdfUpload } from "../../../lib/pdf-storage";
import { getServerUser } from "../../../lib/server-auth";
import { resolveUserName } from "../../../lib/user-name";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Register an uploaded PDF as a private (draft) book in the user's library.
// Any logged-in member can do this (it's personal, not a store publish).
//
// The PDF bytes do NOT pass through this function (Vercel caps request bodies
// at ~4.5MB). Instead we create the draft row and hand back a presigned PUT URL
// so the browser uploads straight to R2. If the client's upload then fails, the
// draft row is left behind with no PDF — the owner can just delete and retry.
export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    title?: unknown;
    author?: unknown;
    coverThumb?: unknown;
    description?: unknown;
    category?: unknown;
    price?: unknown;
  } | null;
  const title = typeof body?.title === "string" ? body.title : "";
  const author = typeof body?.author === "string" ? body.author : undefined;
  const coverThumb =
    typeof body?.coverThumb === "string" ? body.coverThumb : undefined;
  const description =
    typeof body?.description === "string" ? body.description : undefined;
  const category =
    typeof body?.category === "string" ? body.category : undefined;
  const price = typeof body?.price === "number" ? body.price : undefined;

  const book = await insertPdfBook(
    { title, author, coverThumb, description, category, price },
    { id: user.id, name: await resolveUserName(user) },
  );
  const uploadUrl = await presignPdfUpload(book.id);

  return Response.json({ book, uploadUrl }, { status: 201 });
}
