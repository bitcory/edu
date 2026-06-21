import { getServerUser } from "../../../lib/server-auth";
import { readStoryImage } from "../../../lib/pdf-storage";

/** Return story image keys as base64 data URLs. Used to feed reference character
 * images into ChatGPT image-to-image (the extension uploads them as files), which
 * a browser fetch of the R2 URL couldn't do due to CORS. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { keys?: string[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const keys = Array.isArray(body.keys) ? body.keys.filter((k) => typeof k === "string" && k.startsWith("story/")) : [];
  const dataUrls: Record<string, string> = {};
  await Promise.all(
    keys.map(async (key) => {
      const buf = await readStoryImage(key);
      if (!buf) return;
      const ext = (key.split(".").pop() || "png").toLowerCase();
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
      dataUrls[key] = `data:${mime};base64,${buf.toString("base64")}`;
    }),
  );
  return Response.json({ dataUrls });
}
