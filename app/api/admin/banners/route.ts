import { listBanners, insertBanner } from "../../../lib/banners-repo";
import { presignBannerDownload } from "../../../lib/pdf-storage";
import { getServerUser } from "../../../lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getServerUser();
  if (!user?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });
  const banners = await listBanners();
  const out = await Promise.all(
    banners.map(async (b) => ({
      ...b,
      imageUrl: await presignBannerDownload(b.imageKey),
    })),
  );
  return Response.json({ banners: out });
}

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user?.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    imageKey?: unknown; linkUrl?: unknown; startsAt?: unknown; endsAt?: unknown; sort?: unknown;
  } | null;
  const imageKey = typeof body?.imageKey === "string" ? body.imageKey : "";
  if (!imageKey.startsWith("banners/")) {
    return Response.json({ error: "imageKey required" }, { status: 400 });
  }
  const banner = await insertBanner({
    imageKey,
    linkUrl: typeof body?.linkUrl === "string" && body.linkUrl.trim() ? body.linkUrl.trim() : null,
    startsAt: typeof body?.startsAt === "number" ? body.startsAt : null,
    endsAt: typeof body?.endsAt === "number" ? body.endsAt : null,
    sort: typeof body?.sort === "number" ? body.sort : 0,
  });
  return Response.json({ banner }, { status: 201 });
}
