import { type NextRequest } from "next/server";
import { toggleLike } from "../../../../lib/social-repo";
import { getServerUser } from "../../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Toggle the current user's like on a book. Returns the new state + count.
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await toggleLike(id, user.id);
  return Response.json(result);
}
