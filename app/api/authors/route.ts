import { type NextRequest } from "next/server";
import { listAuthors } from "../../lib/authors-repo";
import { getServerUser } from "../../lib/server-auth";
import type { AuthorStatus } from "../../lib/author-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user?.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const raw = req.nextUrl.searchParams.get("scope") ?? "pending";
  const scope = (["pending", "approved", "rejected"].includes(raw)
    ? raw
    : "pending") as AuthorStatus;
  const authors = await listAuthors(scope);
  return Response.json({ authors });
}
