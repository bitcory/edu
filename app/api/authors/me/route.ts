import { type NextRequest } from "next/server";
import {
  applyAuthor,
  ensureApprovedAuthor,
  getAuthor,
} from "../../../lib/authors-repo";
import { getServerUser } from "../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  let author = await getAuthor(user.id);
  // Admins are approved authors by default.
  if (user.isAdmin && author?.status !== "approved") {
    author = await ensureApprovedAuthor(user.id, user.email, user.name);
  }
  return Response.json({ author });
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  if (
    !body?.displayName ||
    (body.type !== "individual" && body.type !== "business")
  ) {
    return Response.json(
      { error: "displayName과 유형(개인/개인사업자)이 필요해요." },
      { status: 400 },
    );
  }

  const author = await applyAuthor(user.id, user.email, {
    displayName: body.displayName,
    type: body.type,
    businessName: body.businessName,
    intro: body.intro,
    avatarDataUrl: body.avatarDataUrl,
    consentPII: body.consentPII === true,
    rrn: body.rrn,
    bizNo: body.bizNo,
    bankName: body.bankName,
    bankAccount: body.bankAccount,
    accountHolder: body.accountHolder,
  });
  return Response.json({ author }, { status: 201 });
}
