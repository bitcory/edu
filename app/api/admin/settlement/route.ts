import { type NextRequest } from "next/server";
import { getServerUser } from "../../../lib/server-auth";
import {
  getSettlement,
  periodOf,
  setAuthorShare,
} from "../../../lib/settlement-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Monthly read-based settlement for all authors. Admin only.
export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user?.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const period = req.nextUrl.searchParams.get("period") || periodOf();
  const settlement = await getSettlement(period);
  return Response.json(settlement);
}

// Adjust one author's revenue-share percent. Admin only.
export async function PATCH(req: NextRequest) {
  const user = await getServerUser();
  if (!user?.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json()) as { userId?: string; share?: number };
  if (!body.userId || typeof body.share !== "number") {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  await setAuthorShare(body.userId, body.share);
  return Response.json({ ok: true });
}
