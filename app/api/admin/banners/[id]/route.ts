import { getBanner, updateBanner, deleteBanner } from "../../../../lib/banners-repo";
import { deleteBannerImage } from "../../../../lib/pdf-storage";
import { getServerUser } from "../../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    linkUrl?: unknown; startsAt?: unknown; endsAt?: unknown; sort?: unknown;
  } | null;
  // null = 지움, undefined(미포함) = 유지
  await updateBanner(id, {
    linkUrl:
      body?.linkUrl === null ? null
      : typeof body?.linkUrl === "string" ? (body.linkUrl.trim() || null)
      : undefined,
    startsAt: body?.startsAt === null ? null : typeof body?.startsAt === "number" ? body.startsAt : undefined,
    endsAt: body?.endsAt === null ? null : typeof body?.endsAt === "number" ? body.endsAt : undefined,
    sort: typeof body?.sort === "number" ? body.sort : undefined,
  });
  return Response.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const banner = await getBanner(id);
  await deleteBanner(id);
  if (banner) await deleteBannerImage(banner.imageKey);
  return Response.json({ ok: true });
}
