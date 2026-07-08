import { renameOwnerBooks } from "../../../lib/books-repo";
import { renameAuthorDisplayName } from "../../../lib/authors-repo";
import { getServerUser } from "../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { oldName?: unknown; newName?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const newName = typeof body.newName === "string" ? body.newName.trim() : "";
  const oldName = typeof body.oldName === "string" ? body.oldName.trim() : "";
  if (!newName) {
    return Response.json({ error: "newName required" }, { status: 400 });
  }

  await renameOwnerBooks(user.id, oldName || user.name, newName);
  await renameAuthorDisplayName(user.id, oldName || user.name, newName);
  return Response.json({ ok: true });
}
