import { listPublicAuthors } from "../../../lib/authors-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public directory of approved authors (PII-free) for the 작가 선택 picker.
// Static segment → resolves before the dynamic /api/authors/[id] route.
export async function GET() {
  const authors = await listPublicAuthors();
  return Response.json({ authors });
}
