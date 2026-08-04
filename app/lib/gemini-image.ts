import { resolveAiStudioKey } from "./credentials";
import { getImageModel } from "./users-repo";

/**
 * Gemini 이미지 생성 (Google AI Studio).
 *
 * 확장 프로그램이 ChatGPT·Flow 웹 UI 를 조작하던 자리를 대신한다. 서버에서
 * 직접 부르므로 브라우저·로그인 세션이 필요 없고, 컷을 일괄로 돌릴 수 있다.
 *
 * 레퍼런스 이미지를 함께 보낼 수 있다 — 캐릭터 시트를 물려서 컷을 만들면
 * 컷마다 얼굴이 달라지는 문제가 줄어든다. 이게 i2i 파이프라인의 핵심이다.
 *
 * 모델은 사용자가 설정에서 고른 값을 쓴다(app/lib/image-models.ts).
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** 앱이 쓰는 화면비. Gemini 의 imageConfig.aspectRatio 가 그대로 받는다. */
export type Aspect = "1:1" | "3:4" | "4:3" | "16:9" | "9:16";

export type ImageResult =
  | { ok: true; dataUrl: string; model: string }
  | { ok: false; error: string };

/** data URL → Gemini 가 받는 inlineData 파트. 형식이 아니면 건너뛴다. */
function toInlinePart(dataUrl: string): { inlineData: { mimeType: string; data: string } } | null {
  const m = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(dataUrl.trim());
  if (!m) return null;
  return { inlineData: { mimeType: m[1], data: m[2] } };
}

export async function generateImage(
  userId: string,
  opts: {
    prompt: string;
    aspect?: Aspect;
    /** 캐릭터 시트 등 참조 이미지 (data URL). 앞쪽이 더 강하게 반영된다. */
    references?: string[];
    signal?: AbortSignal;
  },
): Promise<ImageResult> {
  const resolved = await resolveAiStudioKey(userId);
  if (!resolved) {
    return {
      ok: false,
      error: "Google AI Studio 키가 없어요. 설정 → AI 키에서 넣어 주세요.",
    };
  }
  const model = await getImageModel(userId);

  const parts: Record<string, unknown>[] = [];
  // 참조 이미지를 먼저 넣고 지시를 뒤에 둔다 — 모델이 "이 그림들을 참고해서
  // 이렇게 그려라" 순서로 읽는다.
  for (const ref of opts.references ?? []) {
    const part = toInlinePart(ref);
    if (part) parts.push(part);
  }
  parts.push({ text: opts.prompt });

  let res: Response;
  try {
    res = await fetch(
      `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(resolved.key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: opts.signal ?? AbortSignal.timeout(120_000),
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            ...(opts.aspect ? { imageConfig: { aspectRatio: opts.aspect } } : {}),
          },
        }),
      },
    );
  } catch (e) {
    const aborted = (e as Error)?.name === "AbortError";
    return {
      ok: false,
      error: aborted ? "취소됐어요." : "구글에 연결하지 못했어요.",
    };
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    const detail = body?.error?.message?.trim();
    return {
      ok: false,
      error: detail ? `구글이 거부했어요: ${detail}` : `구글 응답 오류 (${res.status})`,
    };
  }

  const data = (await res.json().catch(() => null)) as {
    candidates?: {
      content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] };
      finishReason?: string;
    }[];
    promptFeedback?: { blockReason?: string };
  } | null;

  const blocked = data?.promptFeedback?.blockReason;
  if (blocked) {
    return {
      ok: false,
      error: `안전 필터에 걸렸어요 (${blocked}). 프롬프트를 조금 눅여 주세요.`,
    };
  }

  const candidate = data?.candidates?.[0];
  const image = candidate?.content?.parts?.find((p) => p.inlineData?.data);
  if (!image?.inlineData?.data) {
    return {
      ok: false,
      error:
        candidate?.finishReason === "IMAGE_SAFETY"
          ? "안전 필터에 걸려 그림이 나오지 않았어요. 프롬프트를 조금 바꿔 보세요."
          : "그림이 오지 않았어요. 잠시 후 다시 시도해 주세요.",
    };
  }

  const mime = image.inlineData.mimeType || "image/png";
  return { ok: true, dataUrl: `data:${mime};base64,${image.inlineData.data}`, model };
}
