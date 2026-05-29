import { type NextRequest } from "next/server";
import { getSocial } from "../../../../lib/social-repo";
import { getServerUser } from "../../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Likes + comments for a book, plus whether the current user has liked it.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await getServerUser();
  const social = await getSocial(id, user?.id);
  return Response.json(social);
}
