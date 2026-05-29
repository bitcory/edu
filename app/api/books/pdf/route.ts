import { type NextRequest } from "next/server";
import { insertPdfBook } from "../../../lib/books-repo";
import { savePdf } from "../../../lib/pdf-storage";
import { getServerUser } from "../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Register an uploaded PDF as a private (draft) book in the user's library.
// Any logged-in member can do this (it's personal, not a store publish).
export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "");
  const coverThumb = form.get("coverThumb");

  if (!(file instanceof File)) {
    return Response.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > 50 * 1024 * 1024) {
    return Response.json({ error: "파일이 너무 커요 (최대 50MB)." }, { status: 413 });
  }

  const book = await insertPdfBook(
    { title, coverThumb: typeof coverThumb === "string" ? coverThumb : undefined },
    { id: user.id, name: user.name },
  );
  const bytes = new Uint8Array(await file.arrayBuffer());
  await savePdf(book.id, bytes);

  return Response.json({ book }, { status: 201 });
}
