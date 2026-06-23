// 웹툰 v3.0 스타일 프리셋 라이브러리 (지침: webtoon/3.0/style_library.json).
// 작품 JSON은 style_set(프리셋 id)과 pages[].tone 만 두고, 스타일 문자열은 내장하지
// 않는다는 게 원칙이지만, 실제 산출물은 image_prompt 에 art_style·tone 을 미리 구워
// 넣기도 한다. 그래서 스토리구성 임포터는 "빠진 항목만 보강 병합"한다(중복 방지).
// 핵심 효과: safety_context 가 빠진 컷/캐릭터에 안전 문구를 붙여 콘텐츠 정책 오탐을
// 줄이고, 스타일이 안 구워진 구버전 파일도 art_style·tone 을 채워준다.

export type WebtoonTone = { label: string; prompt: string };
export type WebtoonPreset = {
  label: string;
  best_for?: string;
  art_style: string;
  tones: Record<string, WebtoonTone>;
  safety_context?: string;
};

// style_library.json 의 negative 와 동일.
export const WEBTOON_NEGATIVE =
  "no text, no letters, no panel numbers, no watermark, no logo, empty blank speech bubbles";

export const WEBTOON_PRESETS: Record<string, WebtoonPreset> = {
  "lineart-webtoon/v1": {
    label: "한국 웹툰 선화풍",
    best_for: "감정선·일상·가족·치유물. 가장 표준적이고 표정 전달이 또렷함.",
    art_style:
      "clean korean webtoon line art, gentle fine linework, restrained coloring, clear readable expressions",
    tones: {
      warm: { label: "따뜻·일상", prompt: "soft warm tone, cozy gentle light, tender everyday atmosphere, delicate small flowers" },
      calm: { label: "차분·사색", prompt: "calm muted blue-grey palette, quiet reflective mood, still and tender atmosphere" },
      gold: { label: "해소·감동", prompt: "warm golden afternoon light, soft amber glow, hopeful tender atmosphere, delicate small flowers" },
    },
  },
  "painterly-emotional/v1": {
    label: "페인터리 감성 일러스트",
    best_for: "감성·고독·새벽 톤의 분위기 깊은 작품. 붓터치로 정서 전달.",
    art_style:
      "soft painterly anime illustration, fine linework, watercolor-like shading, korean webtoon aesthetic, atmospheric depth",
    tones: {
      blue: { label: "밤·고독", prompt: "deep moody blue monochrome palette, cinematic night lighting, warm lamp glow accents, delicate small white flowers, quiet lonely atmosphere" },
      sepia: { label: "회상·꿈", prompt: "faded warm sepia tone, nostalgic dreamlike haze, soft golden memory light, gentle bokeh, tender bittersweet atmosphere" },
      gold: { label: "해소·새벽", prompt: "warm golden dawn light, soft amber glow, gentle morning haze, delicate small white flowers, hopeful tender atmosphere" },
    },
  },
  "anime-romance/v1": {
    label: "일본 애니메이션풍",
    best_for: "로맨스·청춘·학원물. 또렷한 눈·셀 채색으로 캐릭터 매력 부각.",
    art_style:
      "japanese anime style illustration, crisp clean cel shading, expressive large eyes, vibrant clear colors, korean webtoon layout",
    tones: {
      day: { label: "밝은 낮·설렘", prompt: "bright clear daylight, fresh vivid colors, cheerful youthful atmosphere, soft lens flare" },
      sunset: { label: "노을·고백", prompt: "warm orange sunset glow, romantic golden hour light, tender blushing atmosphere, soft bokeh" },
      night: { label: "밤·여운", prompt: "deep blue night with city or star lights, cool cinematic mood, quiet emotional atmosphere" },
    },
  },
  "watercolor-storybook/v1": {
    label: "수채화·동화풍",
    best_for: "가족·치유·어린 화자 이야기. 따뜻한 손그림 질감.",
    art_style:
      "soft watercolor storybook illustration, hand-painted texture, gentle paper grain, warm muted palette, tender picture-book feel",
    tones: {
      warm: { label: "따뜻·포근", prompt: "warm soft watercolor wash, cozy gentle light, tender storybook atmosphere, delicate small flowers" },
      misty: { label: "잔잔·아련", prompt: "soft hazy pastel watercolor, gentle muted tones, quiet wistful atmosphere" },
      gold: { label: "해소·희망", prompt: "warm golden watercolor light, soft amber wash, hopeful tender atmosphere, delicate blossoms" },
    },
    safety_context:
      "wholesome child-friendly cartoon, harmless and innocent, no weapons, no danger, gentle storybook mood",
  },
  "pastel-flat/v1": {
    label: "파스텔 플랫풍",
    best_for: "일상·공감툰·SNS 숏툰. 매끈한 면·부드러운 색, 가볍고 친근.",
    art_style:
      "soft pastel flat illustration, smooth clean shapes, minimal shading, gentle rounded linework, friendly modern webtoon look",
    tones: {
      soft: { label: "포근·일상", prompt: "soft pastel palette, gentle even light, warm friendly everyday atmosphere" },
      cool: { label: "차분·혼자", prompt: "cool muted pastel tones, calm quiet mood, gentle melancholy" },
      sunny: { label: "밝음·긍정", prompt: "bright cheerful pastel colors, sunny warm light, uplifting hopeful atmosphere" },
    },
  },
  "claymation/v1": {
    label: "클레이메이션 (점토 애니)",
    best_for: "동화·가족·따뜻한 코미디. 점토 인형 질감의 포근하고 친근한 느낌.",
    art_style:
      "claymation stop-motion style, soft clay texture, handmade plasticine figures, gentle studio lighting, rounded tactile shapes, consistent character model across all panels",
    tones: {
      warm: { label: "따뜻·포근", prompt: "warm cozy clay tones, soft inviting light, tender handmade atmosphere" },
      cool: { label: "차분·잔잔", prompt: "cool muted clay tones, calm quiet mood, gentle melancholy" },
      bright: { label: "밝음·명랑", prompt: "bright cheerful clay colors, sunny playful light, uplifting atmosphere" },
    },
    safety_context:
      "wholesome child-friendly cartoon, harmless and innocent, no weapons, no danger, gentle storybook mood",
  },
  "pixar-3d/v1": {
    label: "3D 입체 애니 (픽사풍)",
    best_for: "가족·모험·밝은 감동물. 둥근 입체감과 광택, 표정 풍부.",
    art_style:
      "3D animated film style, rounded appealing character design, glossy soft rendering, cinematic depth of field, expressive faces, keep the same character model and colors consistent across all panels",
    tones: {
      day: { label: "밝은 낮", prompt: "bright warm daylight, vivid cheerful colors, lively atmosphere" },
      sunset: { label: "노을·감동", prompt: "warm golden sunset glow, emotional cinematic light, tender atmosphere" },
      night: { label: "밤·잔잔", prompt: "soft blue night lighting, cozy warm lamp accents, calm quiet mood" },
    },
  },
  "manhwa-romance/v1": {
    label: "정통 순정 웹툰풍",
    best_for: "로맨스·드라마·감정 깊은 서사. 미려한 선과 화사한 채색, 빛 표현 강조.",
    art_style:
      "polished korean romance webtoon style, refined detailed linework, luminous soft coloring, beautiful expressive characters, sparkling light effects, consistent character identity across panels",
    tones: {
      day: { label: "화사·설렘", prompt: "bright airy daylight, soft pastel highlights, fluttering romantic mood, light bloom" },
      sunset: { label: "노을·애틋", prompt: "warm rose-gold sunset, dreamy emotional glow, tender longing atmosphere" },
      night: { label: "밤·깊은 감정", prompt: "deep blue night with glowing city or star lights, cinematic emotional mood" },
    },
  },
  "ink-wash/v1": {
    label: "수묵·동양화풍",
    best_for: "사극·전통·잔잔한 사색물. 먹선과 여백의 미, 절제된 감성.",
    art_style:
      "east-asian ink wash painting style, expressive brush strokes, soft ink gradients, elegant negative space, restrained color accents, consistent character features across panels",
    tones: {
      misty: { label: "안개·고요", prompt: "soft misty ink tones, quiet contemplative mood, pale atmospheric haze" },
      warm: { label: "온화·정겨움", prompt: "warm sepia ink wash, gentle tender atmosphere, soft earth tones" },
      moonlit: { label: "달밤·서정", prompt: "cool moonlit ink tones, poetic night stillness, silver-blue accents" },
    },
  },
  "crayon-childlike/v1": {
    label: "크레용·아동 그림풍",
    best_for: "어린이·순수·동심 이야기. 크레용 질감의 삐뚤빼뚤 따뜻한 손맛.",
    art_style:
      "childlike crayon drawing style, waxy textured strokes, naive warm shapes, hand-drawn imperfect charm, paper grain, keep the same character look consistent across panels",
    tones: {
      warm: { label: "따뜻·포근", prompt: "warm crayon colors, cozy gentle mood, tender childlike atmosphere" },
      bright: { label: "밝음·신남", prompt: "bright playful crayon colors, cheerful energetic mood" },
      soft: { label: "잔잔·아련", prompt: "soft muted crayon tones, quiet wistful gentle mood" },
    },
    safety_context:
      "wholesome child-friendly cartoon, harmless and innocent, no weapons, no danger, gentle storybook mood",
  },
};

/** style_set id 로 프리셋을 찾는다. 없으면 null. */
export function webtoonPreset(styleSet?: string): WebtoonPreset | null {
  if (!styleSet) return null;
  return WEBTOON_PRESETS[styleSet] ?? null;
}

/**
 * base 프롬프트에 parts 를 "빠진 것만" 이어 붙인다. 이미 들어있는 조각은 건너뛰어
 * 중복을 막는다(앞 24자 기준 매칭). v3.0(스타일 내장)·구버전(미내장) 모두 안전.
 */
export function mergePromptParts(base: string, parts: (string | undefined)[]): string {
  let out = (base || "").trim();
  const has = (p: string) =>
    out.toLowerCase().includes(p.toLowerCase().slice(0, 24).trim());
  for (const part of parts) {
    const p = (part || "").trim();
    if (!p || has(p)) continue;
    out += (out.endsWith(".") || out.endsWith(",") ? " " : ". ") + p;
  }
  return out;
}
