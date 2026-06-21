import { getServerUser } from "../../../lib/server-auth";

/**
 * Path A — server-side image generation (no extension needed).
 * Supports OpenAI gpt-image-1 and fal.ai FLUX schnell, mirroring ai-video-studio's
 * services/image.ts. Returns a base64 data URL. Client abort propagates via
 * request.signal so the "정지" button cancels the upstream call too.
 *
 * Keys (set in .env.local): OPENAI_API_KEY and/or FAL_KEY.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Aspect = "1:1" | "3:4" | "4:3" | "16:9" | "9:16";
type Provider = "openai" | "fal";

const OPENAI_SIZE: Record<Aspect, string> = {
  "1:1": "1024x1024",
  "3:4": "1024x1536",
  "9:16": "1024x1536",
  "4:3": "1536x1024",
  "16:9": "1536x1024",
};
const FAL_SIZE: Record<Aspect, string> = {
  "1:1": "square_hd",
  "3:4": "portrait_4_3",
  "9:16": "portrait_16_9",
  "4:3": "landscape_4_3",
  "16:9": "landscape_16_9",
};

function pickProvider(requested?: string): Provider | null {
  if (requested === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (requested === "fal" && process.env.FAL_KEY) return "fal";
  if (!requested) {
    if (process.env.OPENAI_API_KEY) return "openai";
    if (process.env.FAL_KEY) return "fal";
  }
  return null;
}

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { prompt?: string; aspect?: Aspect; provider?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const prompt = (body.prompt || "").trim();
  const aspect: Aspect = body.aspect && body.aspect in OPENAI_SIZE ? body.aspect : "16:9";
  if (!prompt) return Response.json({ error: "프롬프트가 비어 있어요." }, { status: 400 });

  const provider = pickProvider(body.provider);
  if (!provider) {
    return Response.json(
      { error: "이미지 API 키가 설정되지 않았어요. .env.local에 OPENAI_API_KEY 또는 FAL_KEY를 추가하세요." },
      { status: 400 },
    );
  }

  try {
    if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        signal: req.signal,
        headers: {
          authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: "gpt-image-1", prompt, size: OPENAI_SIZE[aspect], n: 1 }),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        return Response.json({ error: `OpenAI 오류 ${r.status}: ${t.slice(0, 300)}` }, { status: 502 });
      }
      const data = await r.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (!b64) return Response.json({ error: "OpenAI 응답에 이미지가 없어요." }, { status: 502 });
      return Response.json({ dataUrl: `data:image/png;base64,${b64}`, provider });
    }

    // fal.ai FLUX schnell
    const r = await fetch("https://fal.run/fal-ai/flux/schnell", {
      method: "POST",
      signal: req.signal,
      headers: {
        authorization: `Key ${process.env.FAL_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ prompt, image_size: FAL_SIZE[aspect], num_images: 1 }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return Response.json({ error: `fal 오류 ${r.status}: ${t.slice(0, 300)}` }, { status: 502 });
    }
    const data = await r.json();
    const url = data?.images?.[0]?.url;
    if (!url) return Response.json({ error: "fal 응답에 이미지가 없어요." }, { status: 502 });
    const img = await fetch(url, { signal: req.signal });
    const buf = Buffer.from(await img.arrayBuffer());
    const mime = img.headers.get("content-type") || "image/jpeg";
    return Response.json({ dataUrl: `data:${mime};base64,${buf.toString("base64")}`, provider });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") {
      return Response.json({ error: "취소됨" }, { status: 499 });
    }
    return Response.json({ error: (e as Error)?.message || "이미지 생성 실패" }, { status: 500 });
  }
}
