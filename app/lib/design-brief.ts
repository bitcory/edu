import { PB_THEMES, type PbStyleBlock, type PbTheme } from "./picturebook-schema";

/**
 * /story/design 이 모으는 설계 입력값과, 거기서 결정적으로 만들어지는 부분.
 *
 * 중요한 구분: meta 와 style_block 은 **AI 없이** 입력값만으로 조립된다.
 * 특히 style_block 은 실패 모드가 몰려 있는 곳이라(만트라 중복, common 에 글자
 * 금지 등) 모델에 맡기지 않고 여기서 고정한다. 모델은 이야기·캐릭터·컷처럼
 * 창작이 필요한 부분만 만든다.
 */

export type MakeMode = "create" | "adapt" | "together";
export type MotionPlan = "still" | "motion" | "unsure";

export const MAKE_MODES: { id: MakeMode; label: string; desc: string }[] = [
  { id: "create", label: "창작", desc: "새로운 이야기를 직접 만들어요" },
  { id: "adapt", label: "각색", desc: "알고 있는 이야기를 각색해요" },
  { id: "together", label: "공동창작", desc: "아이와 같이 만들어요" },
];

export const MOODS = [
  { id: "warm", label: "따뜻한", desc: "포근하고 안전한 느낌" },
  { id: "calm", label: "잔잔한", desc: "조용히 마음에 스며드는" },
  { id: "cheerful", label: "명랑한", desc: "밝고 신나는" },
  { id: "touching", label: "뭉클한", desc: "마음이 찡한" },
  { id: "adventurous", label: "모험적인", desc: "씩씩하고 두근거리는" },
] as const;

export const MOTION_PLANS: { id: MotionPlan; label: string }[] = [
  { id: "still", label: "그림책만 만들어요" },
  { id: "motion", label: "나중에 영상으로도 만들어요" },
  { id: "unsure", label: "잘 모르겠어요 — 일단 그림책부터" },
];

/**
 * 지침의 6종 화풍. `common` 은 style_block.common 첫 문구가 된다.
 * `motionFit` 은 영상 계획을 고른 사용자에게 적합도를 표시하는 용도.
 */
export const ART_STYLES = [
  {
    id: "pixar3d",
    label: "픽사 3D",
    desc: "둥글둥글 입체, 광택",
    motionFit: "good",
    common:
      "Pixar 3D style children's picture book illustration, rounded child-friendly shapes, glossy 3D rendering with rich shading, warm natural lighting, emotional readability first.",
  },
  {
    id: "chibi2d",
    label: "치비 2D",
    desc: "큰 머리·큰 눈, 평면 채색",
    motionFit: "ok",
    common:
      "Chibi 2D children's picture book illustration, large head and big expressive eyes, simple flat coloring with soft outlines, cute and readable at a glance.",
  },
  {
    id: "koreanani",
    label: "한국 유아 애니풍",
    desc: "부드러운 선·파스텔 톤",
    motionFit: "ok",
    common:
      "Korean preschool animation style illustration, soft gentle linework, pastel palette, friendly rounded characters, calm and warm atmosphere.",
  },
  {
    id: "watercolor",
    label: "수채화·색연필",
    desc: "손그림 질감, 종이 결",
    motionFit: "poor",
    common:
      "Watercolor and colored pencil children's book illustration, visible paper grain, soft bleeding edges, hand-drawn warmth, gentle muted palette.",
  },
  {
    id: "cel",
    label: "셀 애니풍",
    desc: "또렷한 선 + 면 채색",
    motionFit: "great",
    common:
      "Cel animation style children's picture book illustration, clean crisp linework with flat color fills, clear shape silhouettes, bright and readable.",
  },
  {
    id: "flat",
    label: "플랫 일러스트",
    desc: "매끈한 면, 그림자 최소",
    motionFit: "great",
    common:
      "Flat vector illustration for a children's picture book, smooth clean shapes, minimal shading, bold simple color blocking, modern and airy.",
  },
] as const;

export type ArtStyleId = (typeof ART_STYLES)[number]["id"];

export const THEME_LABELS: Record<PbTheme, string> = {
  warm: "따뜻",
  night: "밤",
  forest: "숲",
  ocean: "바다",
  sunset: "노을",
  candy: "명랑",
};

export const THEMES = PB_THEMES.map((id) => ({ id, label: THEME_LABELS[id] }));

/** 설계 화면이 모으는 값 전체. */
export type DesignBrief = {
  mode: MakeMode;
  /** 각색일 때 원작명 */
  source: string;
  age: string;
  seed: string;
  mood: string;
  motion: MotionPlan;
  artStyle: ArtStyleId;
  theme: PbTheme;
  cutCount: number;
  /** 사용자가 미리 정한 등장인물. 비우면 이야기에서 자동으로 뽑는다. */
  characters: { name: string; role: string; idPoint: string }[];
  autoCharacters: boolean;
  /** 제목을 직접 정할 때. 비우면 후보를 만들어 준다. */
  title: string;
  message: string;
};

export const EMPTY_BRIEF: DesignBrief = {
  mode: "create",
  source: "",
  age: "4-5",
  seed: "",
  mood: "warm",
  motion: "still",
  artStyle: "pixar3d",
  theme: "warm",
  cutCount: 14,
  characters: [],
  autoCharacters: true,
  title: "",
  message: "",
};

/**
 * 여백 만트라 — style_block.scene_add 에만 들어간다.
 *
 * 이 문구가 개별 prompt_en 에도 들어가면 같은 지시가 두 번 걸려 모델이 과강조로
 * 받고 단색 띠를 만든다(문서에 기록된 실전 실패). 그래서 한 곳에만 둔다.
 */
export const SCENE_MANTRA =
  "Each scene must keep at least 40 percent empty space for future text placement. " +
  "The empty area is the same scene continuing, gradually softening into a gentle out-of-focus blur — " +
  "one continuous scene, no split screen, no divided panels, no hard vertical or horizontal seam. " +
  "Keep backgrounds simple, warm, bright and not visually crowded. " +
  "No text, no letters, no words, no captions, wordless illustration.";

const CHARACTER_ADD =
  "character reference sheet on a clean soft neutral background, consistent colors across all views, " +
  "T-pose plus expression close-ups for easy rigging reference.";

const COVER_ADD =
  "picture-book cover composition, warm inviting mood. Leave blank space for title; do NOT render any text or letters.";

/**
 * 입력값에서 style_block 을 조립한다. 모델을 거치지 않는다 —
 * 여기가 실패 모드가 가장 몰려 있는 자리라 사람이 정한 문구로 고정한다.
 *
 * common 에는 글자 금지 문구를 넣지 않는다. scene_add 와 합쳐지면 같은 지시가
 * 두 번 들어가 과강조로 단색 띠·어두운 결과가 나온다.
 */
export function buildStyleBlock(brief: DesignBrief): PbStyleBlock {
  const style = ART_STYLES.find((s) => s.id === brief.artStyle) ?? ART_STYLES[0];
  return {
    common: style.common,
    character_add: CHARACTER_ADD,
    scene_add: SCENE_MANTRA,
    cover_add: COVER_ADD,
  };
}

/** 화면·프롬프트에 함께 쓰는 사람이 읽는 요약. */
export function briefSummary(brief: DesignBrief): string {
  const mood = MOODS.find((m) => m.id === brief.mood)?.label ?? brief.mood;
  const style = ART_STYLES.find((s) => s.id === brief.artStyle)?.label ?? "";
  const mode = MAKE_MODES.find((m) => m.id === brief.mode)?.label ?? "";
  const parts = [
    `${mode}`,
    brief.source && `원작 ${brief.source}`,
    `${brief.age}세`,
    `${mood} 분위기`,
    `${style} 화풍`,
    `${brief.cutCount}컷`,
  ].filter(Boolean);
  return parts.join(" · ");
}
