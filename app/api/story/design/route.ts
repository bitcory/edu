import { getServerUser } from "../../../lib/server-auth";
import { generateJson } from "../../../lib/gemini";
import {
  ART_STYLES,
  MOODS,
  buildStyleBlock,
  type DesignBrief,
} from "../../../lib/design-brief";
import {
  validatePictureBook,
  type PbCharacter,
  type PbCover,
  type PbCut,
  type PictureBook,
} from "../../../lib/picturebook-schema";

/**
 * 설계 생성 — 단계별.
 *
 * 한 번에 다 만들면 컷이 늘수록 79초를 넘고, **Cloudflare 가 100초에 연결을
 * 끊는다.** 서버는 멀쩡히 만들고 있는데 화면에는 실패로 뜨고 요금만 나간다.
 * 그래서 각 요청이 100초 아래로 끝나도록 쪼갠다.
 *
 *   story      본문 + 등장인물        ~30초
 *   characters 캐릭터 시트 프롬프트   ~20초
 *   cuts       컷 (기본 8개씩)        ~40초
 *   covers     앞·뒤 표지             ~15초
 *   validate   조립본 규칙 검사        즉시
 *
 * 쪼갠 덕에 지침 본래의 승인 흐름(본문 보고 → 캐릭터 → 컷)도 되살아난다.
 * 이야기가 마음에 안 들면 컷 프롬프트 값을 치르기 전에 멈출 수 있다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 한 요청에 만드는 컷 수.
 *
 * 8개로 잡았더니 응답이 출력 토큰 한도에 걸려 JSON 이 중간에 잘렸다. 컷 하나에
 * prompt_en 250~400자 + 필드 8개가 붙고, thinking 토큰도 같은 예산을 쓴다.
 * 4개면 여유 있게 들어간다. 늘리기 전에 반드시 실제로 확인할 것.
 */
const CUTS_PER_CALL = 4;

type Cast = { id: string; name_ko: string; role: string; id_point: string };
type Story = {
  title: string;
  title_candidates?: string[];
  message: string;
  cast: Cast[];
  body: { no: number; text: string }[];
};

/** 모든 단계가 공유하는 규칙. 전부 실전에서 깨졌던 항목이다. */
const RULES = `
절대 규칙 (어기면 그림이 망가진다):
- prompt_en 에 다음을 절대 쓰지 마라: 퍼센트 표기(예: "40 percent"),
  "reserved for text", "no letters", "no text", "blank", "empty space",
  "paper-textured". 개별 프롬프트에 있으면 모델이 그 영역을 평면 블록으로
  잘라낸다. 여백 확보·글자 금지는 style_block 이 따로 담당한다.
- 여백은 "같은 장면이 이어지며 흐려지는 영역"이다. 다른 장소(다른 방·다른 통로)를
  지정하면 화면이 두 쪽으로 갈라진다.
  패턴: "[인물] stands in the [반대쪽] side of the frame; the same scene
  continues toward the [위치], softening into a gentle out-of-focus [풍경 요소]"
- 카메라는 감정에 복무한다. 외로움·소외 → long shot / 강렬한 감정 → extreme
  close-up / 모험·희망 → low angle / 고민·망설임 → high angle / 그 외 → medium
  shot. 기본은 medium shot 이고 결정적 순간에만 특수 구도를 쓴다. 앞 컷과 같은
  카메라를 연달아 쓰지 마라.
- layout 은 한국어로 "[위치] 40% [풍경 요소] (글 자리)" 형식. "비움"·"종이 톤"·
  "단색" 은 단색 띠로 나오므로 금지.
- prompt_en 은 250~400자 분량의 풍부한 영어 문단. 인물 식별 포인트를 포함한다.
`.trim();

function briefText(brief: DesignBrief): string {
  const mood = MOODS.find((m) => m.id === brief.mood)?.label ?? brief.mood;
  const style = ART_STYLES.find((s) => s.id === brief.artStyle);
  const lines = [
    `- 만들기 방식: ${brief.mode === "adapt" ? `각색 (원작: ${brief.source})` : brief.mode === "together" ? "아이와 공동창작" : "창작"}`,
    `- 대상 연령: ${brief.age}세`,
    `- 이야기 씨앗: ${brief.seed}`,
    `- 분위기: ${mood}`,
    `- 화풍: ${style?.label ?? ""}`,
  ];
  if (brief.title.trim()) lines.push(`- 제목(지정): ${brief.title.trim()}`);
  if (brief.message.trim()) lines.push(`- 한 줄 메시지(지정): ${brief.message.trim()}`);
  if (!brief.autoCharacters && brief.characters.length) {
    lines.push(
      `- 등장인물(지정): ${brief.characters
        .map((c) => `${c.name}(${c.role || "역할 미정"}, 식별: ${c.idPoint || "미정"})`)
        .join(", ")}`,
    );
  }
  return lines.join("\n");
}

const castText = (cast: Cast[]) =>
  cast.map((c) => `- ${c.id} / ${c.name_ko} / ${c.role} / 식별: ${c.id_point}`).join("\n");

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    step?: string;
    brief?: DesignBrief;
    story?: Story;
    characters?: PbCharacter[];
    cuts?: PbCut[];
    covers?: PbCover[];
    from?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const brief = body.brief;
  if (!brief?.seed?.trim()) {
    return Response.json({ error: "이야기 씨앗이 비어 있어요." }, { status: 400 });
  }
  const style = ART_STYLES.find((s) => s.id === brief.artStyle) ?? ART_STYLES[0];
  const stylePrefix = `모든 prompt_en 은 "${style.common}" 로 시작해 화풍을 밝힌 뒤 장면을 묘사한다.`;

  // 모델 실패는 200 + { error } 로 내린다 — 5xx 는 Cloudflare 가 자기 에러
  // 페이지로 갈아치워 본문이 통째로 버려진다(실측).
  const fail = (e: string, detail?: string) => Response.json({ error: e, detail });

  /* ---------------- 1) 이야기 ---------------- */
  if (body.step === "story") {
    const r = await generateJson<Story>(user.id, {
      temperature: 1.0,
      system:
        "너는 아이를 위한 그림책을 쓰는 한국어 스토리텔러다. 이야기가 형식을 위해 " +
        "희생되지 않게 한다. 한 컷 = 한 페이지 = 핵심 행동 하나 = 핵심 감정 하나. " +
        "교훈을 설명하지 말고 장면으로 보여 준다. JSON 만 출력한다.",
      prompt: `아래 설정으로 그림책 본문과 등장인물을 만들어라.

${briefText(brief)}
- 컷 수: 정확히 ${brief.cutCount}컷

연령별 분량: 4-5세는 컷당 2~4문장, 6-7세는 3~5문장, 8+는 유연.
컷 수를 채우려고 사건을 억지로 늘리지 마라.

다음 JSON 만 출력하라:
{
  "title": "제목",
  "title_candidates": ["감정형", "상징형", "그림책형"],
  "message": "책을 덮고 남는 한 문장 (교훈 설명 아님)",
  "cast": [{ "id": "소문자영문", "name_ko": "", "role": "", "id_point": "색·형태 식별 포인트" }],
  "body": [{ "no": 1, "text": "그 컷의 본문" }]
}
body 는 정확히 ${brief.cutCount}개여야 한다.`,
    });
    if (!r.ok) return fail(r.error, r.detail);
    const s = r.value;
    if (!Array.isArray(s?.body) || !Array.isArray(s?.cast)) {
      return fail("본문 결과 형식이 예상과 달랐어요. 다시 시도해 주세요.");
    }
    return Response.json({ story: s, model: r.model });
  }

  /* ---------------- 2) 캐릭터 시트 ---------------- */
  if (body.step === "characters") {
    const story = body.story;
    if (!story?.cast?.length) return fail("먼저 이야기를 만들어 주세요.");
    const r = await generateJson<{ characters: PbCharacter[] }>(user.id, {
      temperature: 0.8,
      system:
        "너는 그림책 i2i 프롬프트 설계자다. 규칙을 문자 그대로 지킨다. JSON 만 출력한다.",
      prompt: `아래 등장인물의 캐릭터 시트 프롬프트를 만들어라.

${briefText(brief)}

등장인물:
${castText(story.cast)}

${stylePrefix}

characters[].prompt_en 은 반드시 "Character reference sheet of " 로 시작하고,
front view / 3/4 side view / back view 와 표정 close-up 여러 개를 요청하며,
색 일관성을 명시한다("Keep the ... color identical across all views").
한 줄 묘사는 금지 — 시트가 아니면 컷마다 얼굴이 달라진다.

${RULES}

다음 JSON 만 출력하라 (필드는 정확히 이 5개):
{ "characters": [ { "id": "", "name_ko": "", "role": "", "id_point": "", "prompt_en": "" } ] }`,
    });
    if (!r.ok) return fail(r.error, r.detail);
    return Response.json({ characters: r.value?.characters ?? [], model: r.model });
  }

  /* ---------------- 3) 컷 (나눠서) ---------------- */
  if (body.step === "cuts") {
    const story = body.story;
    const characters = body.characters;
    if (!story?.body?.length || !characters?.length) {
      return fail("먼저 이야기와 캐릭터를 만들어 주세요.");
    }
    const from = Math.max(1, Number(body.from) || 1);
    const to = Math.min(story.body.length, from + CUTS_PER_CALL - 1);
    const slice = story.body.filter((b) => b.no >= from && b.no <= to);

    const r = await generateJson<{ cuts: PbCut[] }>(user.id, {
      temperature: 0.8,
      system:
        "너는 그림책 i2i 프롬프트 설계자다. 규칙을 문자 그대로 지킨다. JSON 만 출력한다.",
      prompt: `아래 본문 컷들의 그림 프롬프트를 만들어라.

${briefText(brief)}

등장인물 (ref 는 이 id 만 쓴다):
${castText(story.cast)}

이번에 만들 컷 (${from}~${to}번):
${slice.map((b) => `[${b.no}] ${b.text}`).join("\n")}

전체 흐름 참고 (앞뒤 맥락용, 이번에 만들 것은 위 ${from}~${to}번뿐):
${story.body.map((b) => `[${b.no}] ${b.text.slice(0, 40)}…`).join("\n")}

${stylePrefix}

${RULES}

다음 JSON 만 출력하라 (cuts 필드는 정확히 이 9개):
{ "cuts": [ { "no": ${from}, "ref": [""], "camera": "", "composition": "",
  "expression": "", "lighting": "", "background": "", "layout": "", "prompt_en": "" } ] }
cuts 는 ${from}번부터 ${to}번까지 ${slice.length}개다.`,
    });
    if (!r.ok) return fail(r.error, r.detail);
    return Response.json({
      cuts: r.value?.cuts ?? [],
      from,
      to,
      done: to >= story.body.length,
      model: r.model,
    });
  }

  /* ---------------- 4) 표지 ---------------- */
  if (body.step === "covers") {
    const story = body.story;
    const characters = body.characters;
    if (!story?.cast?.length || !characters?.length) {
      return fail("먼저 이야기와 캐릭터를 만들어 주세요.");
    }
    const r = await generateJson<{ covers: PbCover[] }>(user.id, {
      temperature: 0.8,
      system:
        "너는 그림책 표지 프롬프트 설계자다. 규칙을 문자 그대로 지킨다. JSON 만 출력한다.",
      prompt: `아래 그림책의 앞·뒤 표지 프롬프트를 만들어라.

제목: ${story.title}
메시지: ${story.message}
${briefText(brief)}

등장인물 (ref 는 이 id 만 쓴다):
${castText(story.cast)}

${stylePrefix}

${RULES}

다음 JSON 만 출력하라 (covers 필드는 정확히 이 4개, 그 외 금지):
{ "covers": [
  { "type": "front", "ref": [""], "title_area": "제목 들어갈 자리 한 줄", "prompt_en": "" },
  { "type": "back",  "ref": [""], "title_area": "", "prompt_en": "" } ] }`,
    });
    if (!r.ok) return fail(r.error, r.detail);
    return Response.json({ covers: r.value?.covers ?? [], model: r.model });
  }

  /* ---------------- 5) 조립 + 검사 ---------------- */
  if (body.step === "validate") {
    const story = body.story;
    if (!story) return fail("먼저 이야기를 만들어 주세요.");
    const book: PictureBook = {
      meta: {
        title: story.title || brief.title || "제목 없는 그림책",
        source: brief.mode === "adapt" ? `${brief.source} 각색` : "창작",
        age: brief.age,
        mood: MOODS.find((m) => m.id === brief.mood)?.label ?? brief.mood,
        theme: brief.theme,
        message: story.message || brief.message || "",
        cut_count: body.cuts?.length ?? 0,
      },
      // 모델이 만든 값을 쓰지 않는다 — 실패 모드가 몰려 있는 자리라 고정한다.
      style_block: buildStyleBlock(brief),
      characters: body.characters ?? [],
      cuts: (body.cuts ?? []).slice().sort((a, b) => a.no - b.no),
      covers: body.covers ?? [],
    };
    const result = validatePictureBook(book);
    return Response.json({ ok: result.ok, book, issues: result.issues });
  }

  return Response.json({ error: "알 수 없는 단계예요." }, { status: 400 });
}
