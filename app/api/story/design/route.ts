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
  type Issue,
  type PictureBook,
} from "../../../lib/picturebook-schema";

/**
 * 설계 입력값 → 그림책 프롬프트 팩.
 *
 * 두 번에 나눠 만든다. 한 번에 다 시키면 컷이 많아질수록 길이 제한에 걸려
 * 뒷부분이 잘리고, 잘린 것이 조용히 통과한다.
 *   1) 이야기 본문 + 등장인물 (한국어, 짧음)
 *   2) 그걸 근거로 영어 프롬프트 팩 (characters/cuts/covers)
 *
 * style_block 은 모델에 맡기지 않고 코드가 조립해 덮어쓴다. 실패 모드가 가장
 * 몰려 있는 자리라(만트라 중복 → 단색 띠) 사람이 정한 문구로 고정한다.
 *
 * 마지막에 검증기를 태우고, 에러가 있으면 그 목록을 되먹여 한 번만 보정한다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Cast = { id: string; name_ko: string; role: string; id_point: string };
type StoryStep1 = {
  title: string;
  title_candidates?: string[];
  message: string;
  cast: Cast[];
  body: { no: number; text: string }[];
};

/** 두 호출이 공유하는 규칙. 여기 적힌 것들은 전부 실전에서 깨졌던 항목이다. */
const RULES = `
절대 규칙 (어기면 그림이 망가진다):
- cuts[].prompt_en 과 covers[].prompt_en 에 다음을 절대 쓰지 마라:
  퍼센트 표기(예: "40 percent"), "reserved for text", "no letters", "no text",
  "blank", "empty space", "paper-textured".
  → 이 표현이 개별 프롬프트에 있으면 모델이 그 영역을 평면 블록으로 잘라낸다.
  여백 확보와 글자 금지 지시는 style_block 이 따로 담당한다.
- 여백은 "같은 장면이 이어지며 흐려지는 영역"으로 쓴다. 다른 장소(다른 방·다른
  통로)를 지정하면 화면이 두 쪽으로 갈라진다.
  영어 패턴: "[인물] stands in the [반대쪽] side of the frame; the same scene
  continues toward the [위치], softening into a gentle out-of-focus [풍경 요소]"
- cuts[] 필드는 정확히: no, ref, camera, composition, expression, lighting,
  background, layout, prompt_en. emotion·text·scene_no 같은 필드를 넣지 마라.
- covers[] 필드는 정확히: type, ref, title_area, prompt_en. 그 외 금지.
- characters[] 필드는 정확히: id, name_ko, role, id_point, prompt_en.
- characters[].prompt_en 은 반드시 "Character reference sheet of " 로 시작하고,
  front view / 3/4 side view / back view 와 표정 close-up 여러 개를 요청하며,
  색 일관성을 명시한다("Keep the ... color identical across all views").
- ref 는 characters[].id 와 정확히 일치해야 한다. id 는 소문자·숫자·언더스코어.
- 카메라는 감정에 복무한다. 외로움·소외 → long shot / 강렬한 감정(기쁨·슬픔·
  놀람) → extreme close-up / 모험·희망 → low angle / 고민·망설임 → high angle /
  그 외 안정 장면 → medium shot. 기본은 medium shot 이고 결정적 순간에만 특수
  구도를 쓴다. 앞 컷과 같은 카메라를 연달아 쓰지 마라.
- layout 은 한국어로 "[위치] 40% [풍경 요소] (글 자리)" 형식. "비움"·"종이 톤"·
  "단색" 같은 표현은 단색 띠로 나오므로 금지.
- prompt_en 은 250~400자 분량의 풍부한 영어 문단으로 쓴다. 인물 식별 포인트를
  반드시 포함한다.
`.trim();

function briefText(brief: DesignBrief): string {
  const mood = MOODS.find((m) => m.id === brief.mood)?.label ?? brief.mood;
  const style = ART_STYLES.find((s) => s.id === brief.artStyle);
  const lines = [
    `- 만들기 방식: ${brief.mode === "adapt" ? `각색 (원작: ${brief.source})` : brief.mode === "together" ? "아이와 공동창작" : "창작"}`,
    `- 대상 연령: ${brief.age}세`,
    `- 이야기 씨앗: ${brief.seed}`,
    `- 분위기: ${mood}`,
    `- 컷 수: 정확히 ${brief.cutCount}컷`,
    `- 화풍: ${style?.label ?? ""} (${style?.common ?? ""})`,
  ];
  if (brief.title.trim()) lines.push(`- 제목(사용자 지정): ${brief.title.trim()}`);
  if (brief.message.trim())
    lines.push(`- 한 줄 메시지(사용자 지정): ${brief.message.trim()}`);
  if (!brief.autoCharacters && brief.characters.length) {
    lines.push(
      `- 등장인물(사용자 지정): ${brief.characters
        .map((c) => `${c.name}(${c.role || "역할 미정"}, 식별: ${c.idPoint || "미정"})`)
        .join(", ")}`,
    );
  }
  return lines.join("\n");
}

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let brief: DesignBrief;
  try {
    brief = ((await req.json()) as { brief: DesignBrief }).brief;
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!brief?.seed?.trim()) {
    return Response.json({ error: "이야기 씨앗이 비어 있어요." }, { status: 400 });
  }
  if (!Number.isInteger(brief.cutCount) || brief.cutCount < 1 || brief.cutCount > 40) {
    return Response.json({ error: "컷 수가 올바르지 않아요." }, { status: 400 });
  }

  /* ---------- 1) 본문 + 등장인물 ---------- */
  const step1 = await generateJson<StoryStep1>(user.id, {
    temperature: 1.0,
    system:
      "너는 아이를 위한 그림책을 쓰는 한국어 스토리텔러다. 이야기가 형식을 위해 " +
      "희생되지 않게 한다. 한 컷 = 한 페이지 = 핵심 행동 하나 = 핵심 감정 하나. " +
      "교훈을 설명하지 말고 장면으로 보여 준다. JSON 만 출력한다.",
    prompt: `아래 설정으로 그림책 본문과 등장인물을 만들어라.

${briefText(brief)}

연령별 분량: 4-5세는 컷당 2~4문장, 6-7세는 3~5문장, 8+는 유연.
컷 수를 채우려고 사건을 억지로 늘리지 마라.

다음 JSON 만 출력하라:
{
  "title": "제목",
  "title_candidates": ["감정형 제목", "상징형 제목", "그림책형 제목"],
  "message": "책을 덮고 남는 한 문장 (교훈 설명 아님)",
  "cast": [
    { "id": "소문자영문", "name_ko": "한국어 이름", "role": "주인공/조력자 등",
      "id_point": "색·형태로 된 식별 포인트" }
  ],
  "body": [ { "no": 1, "text": "그 컷의 본문" } ]
}
body 는 정확히 ${brief.cutCount}개여야 한다.`,
  });

  // 모델 실패는 200 + { error } 로 내린다. 502·504 로 내리면 Cloudflare 가 그
  // 응답을 자기 에러 페이지로 갈아치워서 본문이 통째로 버려진다(실측).
  // detail 은 구글이 준 원문·잘린 응답 앞부분 — 원인 파악에 이게 결정적이다.
  if (!step1.ok)
    return Response.json({ error: step1.error, detail: step1.detail, at: "본문" });
  const story = step1.value;
  if (!Array.isArray(story?.body) || !Array.isArray(story?.cast)) {
    return Response.json({
      error: "본문 생성 결과의 형식이 예상과 달랐어요. 다시 시도해 주세요.",
    });
  }

  /* ---------- 2) 프롬프트 팩 ---------- */
  const style = ART_STYLES.find((s) => s.id === brief.artStyle) ?? ART_STYLES[0];
  const packPrompt = `아래 이야기로 i2i 이미지 생성용 영어 프롬프트 팩을 만들어라.

${briefText(brief)}

제목: ${story.title}
등장인물:
${story.cast.map((c) => `- ${c.id} / ${c.name_ko} / ${c.role} / 식별: ${c.id_point}`).join("\n")}

본문:
${story.body.map((b) => `[${b.no}] ${b.text}`).join("\n")}

모든 prompt_en 은 "${style.common}" 로 시작하는 문장으로 화풍을 밝힌 뒤 장면을 묘사한다.

${RULES}

다음 JSON 만 출력하라 (다른 키 금지):
{
  "characters": [ { "id": "", "name_ko": "", "role": "", "id_point": "", "prompt_en": "" } ],
  "cuts": [ { "no": 1, "ref": [""], "camera": "", "composition": "", "expression": "",
              "lighting": "", "background": "", "layout": "", "prompt_en": "" } ],
  "covers": [ { "type": "front", "ref": [""], "title_area": "", "prompt_en": "" },
              { "type": "back",  "ref": [""], "title_area": "", "prompt_en": "" } ]
}
cuts 는 정확히 ${brief.cutCount}개, covers 는 앞·뒤 2개다.`;

  let pack = await generateJson<Partial<PictureBook>>(user.id, {
    temperature: 0.8,
    system:
      "너는 그림책 i2i 프롬프트 설계자다. 아래 규칙을 어기면 결과 이미지가 " +
      "망가지므로 규칙을 문자 그대로 지킨다. JSON 만 출력한다.",
    prompt: packPrompt,
  });
  if (!pack.ok)
    return Response.json({ error: pack.error, detail: pack.detail, at: "프롬프트 팩" });

  const assemble = (p: Partial<PictureBook>): PictureBook =>
    ({
      meta: {
        title: story.title || brief.title || "제목 없는 그림책",
        source: brief.mode === "adapt" ? `${brief.source} 각색` : "창작",
        age: brief.age,
        mood: MOODS.find((m) => m.id === brief.mood)?.label ?? brief.mood,
        theme: brief.theme,
        message: story.message || brief.message || "",
        cut_count: brief.cutCount,
      },
      // 코드가 조립한 값으로 덮어쓴다 — 모델이 만든 style_block 은 쓰지 않는다.
      style_block: buildStyleBlock(brief),
      characters: p.characters ?? [],
      cuts: p.cuts ?? [],
      covers: p.covers ?? [],
    }) as PictureBook;

  let book = assemble(pack.value);
  let result = validatePictureBook(book);

  /* ---------- 3) 실패하면 한 번만 보정 ---------- */
  if (!result.ok) {
    const errs = result.issues
      .filter((i) => i.level === "error")
      .map((i) => `- ${i.path}: ${i.message}`)
      .join("\n");
    const repair = await generateJson<Partial<PictureBook>>(user.id, {
      temperature: 0.2,
      system:
        "너는 그림책 프롬프트 팩을 규칙에 맞게 고치는 교정자다. 지적된 부분만 " +
        "고치고 나머지는 그대로 둔다. JSON 만 출력한다.",
      prompt: `아래 JSON 에 규칙 위반이 있다. 지적 사항을 모두 고쳐 같은 구조로 다시 출력하라.

지적 사항:
${errs}

${RULES}

원본:
${JSON.stringify({ characters: book.characters, cuts: book.cuts, covers: book.covers })}

수정본을 { "characters": [...], "cuts": [...], "covers": [...] } 형태로만 출력하라.`,
    });
    if (repair.ok) {
      const repaired = assemble(repair.value);
      const second = validatePictureBook(repaired);
      // 보정이 오히려 나빠지면 원본을 유지한다.
      if (second.issues.filter((i) => i.level === "error").length <
          result.issues.filter((i) => i.level === "error").length) {
        book = repaired;
        result = second;
      }
    }
  }

  return Response.json({
    ok: result.ok,
    book,
    body: story.body,
    titleCandidates: story.title_candidates ?? [],
    issues: result.issues,
    model: pack.model,
  });
}
