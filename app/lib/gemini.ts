import { resolveAiStudioKey } from "./credentials";

/**
 * Google AI Studio(Gemini API) 텍스트 생성.
 *
 * 키는 사용자 것을 먼저 쓰고 없으면 서버 기본값으로 내려간다 — 각자 자기
 * 할당량·자기 요금으로 돌리는 게 기본이다(app/lib/credentials.ts 참조).
 *
 * 모델 ID 는 기억에 의존하지 않고 이 계정의 실제 models 목록에서 확인한 값이다.
 * 목록은 바뀔 수 있으므로 환경변수로 갈아끼울 수 있게 두었다.
 */

/**
 * 별칭을 기본으로 쓴다 — 특정 프리뷰 이름에 묶으면 그게 내려갈 때 기능이 죽는다.
 * (실제로 gemini-2.5-pro 는 models 목록에는 보이지만 "no longer available to
 * new users" 로 거부된다. 목록에 있다고 쓸 수 있는 게 아니다.)
 */
const DEFAULT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-pro-latest";
/** 기본 모델이 막혔을 때 한 번 더 시도할 대안. */
const FALLBACK_MODEL = process.env.GEMINI_TEXT_FALLBACK ?? "gemini-flash-latest";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** 모델 자체를 못 쓰는 경우인지 — 그럴 때만 대안 모델로 갈아탄다. */
function isModelUnavailable(status: number, message?: string): boolean {
  if (status === 404) return true;
  return /no longer available|not found|not supported|does not exist/i.test(
    message ?? "",
  );
}

export type GeminiFailure = {
  ok: false;
  /** 사용자에게 보여줄 한국어 안내 */
  error: string;
  /** 구글이 준 원문 — 로그·디버깅용 */
  detail?: string;
};

export type GeminiJsonSuccess<T> = { ok: true; value: T; model: string };

/**
 * JSON 하나를 받아 온다.
 *
 * responseMimeType 으로 JSON 을 강제하되, 파싱과 형식 검사는 호출부가 다시
 * 한다 — 모델이 스키마를 지켰는지는 별도 검증기(picturebook-schema)가 판정한다.
 */
export async function generateJson<T = unknown>(
  userId: string,
  opts: {
    system: string;
    prompt: string;
    model?: string;
    /** 창의성. 이야기 생성은 높게, 규칙 보정은 낮게. */
    temperature?: number;
    maxOutputTokens?: number;
    signal?: AbortSignal;
  },
): Promise<GeminiJsonSuccess<T> | GeminiFailure> {
  const resolved = await resolveAiStudioKey(userId);
  if (!resolved) {
    return {
      ok: false,
      error:
        "Google AI Studio 키가 없어요. 설정 → AI 키에서 넣어 주세요.",
    };
  }

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: opts.temperature ?? 0.9,
      maxOutputTokens: opts.maxOutputTokens ?? 32768,
    },
  });

  const call = async (m: string) => {
    const url = `${ENDPOINT}/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(resolved.key)}`;
    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: opts.signal ?? AbortSignal.timeout(180_000),
      body,
    });
  };

  let model = opts.model ?? DEFAULT_MODEL;
  let res: Response;
  try {
    res = await call(model);
  } catch (e) {
    const aborted = (e as Error)?.name === "AbortError";
    return {
      ok: false,
      error: aborted
        ? "생성이 너무 오래 걸려 중단했어요. 컷 수를 줄이고 다시 시도해 보세요."
        : "구글에 연결하지 못했어요. 네트워크를 확인해 주세요.",
    };
  }

  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as {
      error?: { message?: string; status?: string };
    } | null;
    const detail = errBody?.error?.message?.trim();

    // 모델이 내려간 경우만 대안으로 한 번 더. 할당량·권한 문제까지 재시도하면
    // 같은 실패를 두 번 겪고 사유만 흐려진다.
    if (isModelUnavailable(res.status, detail) && model !== FALLBACK_MODEL) {
      model = FALLBACK_MODEL;
      try {
        res = await call(model);
      } catch {
        return { ok: false, error: "구글에 연결하지 못했어요." };
      }
    }

    if (!res.ok) {
      const again = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      const msg = again?.error?.message?.trim() ?? detail;
      // 흔한 사유는 그대로 노출하는 편이 훨씬 고치기 쉽다.
      return {
        ok: false,
        error: msg ? `구글이 요청을 거부했어요: ${msg}` : `구글 응답 오류 (${res.status})`,
        detail: msg,
      };
    }
  }

  const data = (await res.json().catch(() => null)) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      finishReason?: string;
    }[];
    promptFeedback?: { blockReason?: string };
  } | null;

  const blocked = data?.promptFeedback?.blockReason;
  if (blocked) {
    return {
      ok: false,
      error: `안전 필터에 걸렸어요 (${blocked}). 이야기 설정을 조금 눅여서 다시 시도해 주세요.`,
    };
  }

  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    // 길이 초과로 잘리면 본문이 비어 온다 — 원인을 알려 준다.
    const reason = candidate?.finishReason;
    return {
      ok: false,
      error:
        reason === "MAX_TOKENS"
          ? "응답이 길이 제한에 걸렸어요. 컷 수를 줄이고 다시 시도해 주세요."
          : "구글이 빈 응답을 돌려줬어요. 잠시 후 다시 시도해 주세요.",
      detail: reason,
    };
  }

  try {
    return { ok: true, value: JSON.parse(text) as T, model };
  } catch {
    return {
      ok: false,
      error: "생성 결과가 올바른 JSON 이 아니었어요. 다시 시도해 주세요.",
      detail: text.slice(0, 300),
    };
  }
}
