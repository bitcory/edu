/**
 * 「그림책 만들기」 카탈로그 — 객관식 자동 생성의 단일 진실 원천.
 *
 * 아이는 주인공 → 행동 → 장소를 고르고 이름만 넣는다. 조합이 유한하므로
 * (7 × 3 × 3 = 63권) 장면 그림은 미리 만들어 STORAGE_DIR/make/ 아래 두고,
 * 실행 시에는 그림을 고르고 문장만 얹는다. 생성 대기 시간이 0이다.
 *
 * 그림 안에 한글을 굽지 않는다 — 이미지 모델은 한글을 자주 깨뜨리고, 아이
 * 이름이 틀리면 그 책은 못 쓴다. 문장은 Fabric Textbox 레이어로 얹는다.
 *
 * 이 파일은 UI, 책 생성 API, 프롬프트 문서(scripts/make-prompts.mjs)가 함께
 * 참조한다. 항목을 추가하면 세 곳에 자동으로 반영된다.
 */

export type CharacterId =
  | "boy"
  | "girl"
  | "rabbit"
  | "cat"
  | "dog"
  | "bear"
  | "fox";
export type ActionId = "play" | "go" | "read";
export type LocationId = "kindergarten" | "beach" | "home";

export type Character = {
  id: CharacterId;
  label: string;
  emoji: string;
  /** 캐릭터 시트 및 모든 장면에서 동일하게 쓰는 외형 서술 — 일관성의 핵심. */
  look: string;
};

export type Action = {
  id: ActionId;
  label: string;
  emoji: string;
  /** 제목에 쓰는 짧은 말 */
  titleWord: string;
};

export type Location = {
  id: LocationId;
  label: string;
  emoji: string;
  /** 프롬프트에 넣는 배경 서술 */
  scene: string;
};

export const CHARACTERS: Character[] = [
  {
    id: "boy",
    label: "남자아이",
    emoji: "👦",
    look: "a cheerful 5-year-old Korean boy with short black hair, round friendly face, wearing a yellow t-shirt and blue shorts",
  },
  {
    id: "girl",
    label: "여자아이",
    emoji: "👧",
    look: "a cheerful 5-year-old Korean girl with shoulder-length black hair tied in two small pigtails, round friendly face, wearing a pink dress",
  },
  {
    id: "rabbit",
    label: "토끼",
    emoji: "🐰",
    look: "a friendly cartoon rabbit character, soft cream-white fur, long floppy ears, big round eyes, wearing a small blue vest, walking upright like a child",
  },
  {
    id: "cat",
    label: "고양이",
    emoji: "🐱",
    look: "a friendly cartoon cat character, orange tabby fur, big round green eyes, small pink nose, wearing a green scarf, walking upright like a child",
  },
  {
    id: "dog",
    label: "강아지",
    emoji: "🐶",
    look: "a friendly cartoon puppy character, golden-brown fur, floppy ears, big warm brown eyes, wearing a red collar with a small tag, walking upright like a child",
  },
  {
    id: "bear",
    label: "곰",
    emoji: "🐻",
    look: "a friendly cartoon bear cub character, soft brown fur, round ears, gentle dark eyes, wearing blue denim overalls, walking upright like a child",
  },
  {
    id: "fox",
    label: "여우",
    emoji: "🦊",
    look: "a friendly cartoon fox character, warm orange fur with a white chest and tail tip, bright curious eyes, wearing a purple hoodie, walking upright like a child",
  },
];

export const ACTIONS: Action[] = [
  { id: "play", label: "신나게 놀아요", emoji: "🎈", titleWord: "신나는 하루" },
  { id: "go", label: "즐겁게 가요", emoji: "🚶", titleWord: "가는 길" },
  { id: "read", label: "친구와 책을 읽어요", emoji: "📚", titleWord: "책 읽는 날" },
];

export const LOCATIONS: Location[] = [
  {
    id: "kindergarten",
    label: "유치원",
    emoji: "🏫",
    scene:
      "a bright cheerful Korean kindergarten with colorful low furniture, picture books, potted plants and big sunny windows",
  },
  {
    id: "beach",
    label: "바닷가",
    emoji: "🏖️",
    scene:
      "a sunny sandy beach with gentle turquoise waves, soft white clouds, a few seashells and a warm blue sky",
  },
  {
    id: "home",
    label: "집",
    emoji: "🏠",
    scene:
      "a cozy warm family living room with a soft rug, cushions, a bookshelf and afternoon light through the window",
  },
];

/* ------------------------------------------------------------------ *
 * 한글 조사
 * ------------------------------------------------------------------ */

/** 마지막 글자에 받침이 있는지. 한글이 아니면 false 취급(받침 없음). */
function hasFinalConsonant(word: string): boolean {
  const ch = word.trim().slice(-1);
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false; // 한글 음절 범위 밖
  return (code - 0xac00) % 28 !== 0;
}

/**
 * 받침에 맞는 조사를 붙인다. "민준은" / "수아는" 처럼 갈린다 — 틀리면 부모
 * 눈에 바로 어색하게 읽힌다.
 */
export function withJosa(
  word: string,
  pair: "은는" | "이가" | "을를" | "과와" | "으로로",
): string {
  const final = hasFinalConsonant(word);
  const table: Record<string, [string, string]> = {
    은는: ["은", "는"],
    이가: ["이", "가"],
    을를: ["을", "를"],
    과와: ["과", "와"],
    으로로: ["으로", "로"],
  };
  const [withFinal, withoutFinal] = table[pair];
  return word + (final ? withFinal : withoutFinal);
}

/* ------------------------------------------------------------------ *
 * 5장 비트 — 문장과 그림이 한 곳에서 정의된다
 * ------------------------------------------------------------------ */

export type Beat = {
  /** 페이지에 얹을 문장 */
  text: (name: string, location: Location) => string;
  /** 이 페이지 그림의 핵심 동작 (프롬프트에 들어간다) */
  moment: (location: Location) => string;
};

export const BEATS: Record<ActionId, Beat[]> = {
  play: [
    {
      text: (n, l) => `${withJosa(n, "은는")} ${l.label}에 왔어요.`,
      moment: () => "arriving happily, looking around with a big excited smile",
    },
    {
      text: (n) => `${withJosa(n, "이가")} 신나게 뛰어놀아요.`,
      moment: () => "running and jumping joyfully, arms up in the air",
    },
    {
      text: () => `친구들이 다가와 인사했어요.`,
      moment: () =>
        "meeting two friendly kid characters who wave hello, all smiling",
    },
    {
      text: () => `모두 함께 즐겁게 놀았어요.`,
      moment: () => "playing together in a happy circle with the friends",
    },
    {
      text: (n) => `${withJosa(n, "은는")} 오늘도 참 행복했어요.`,
      moment: () =>
        "sitting down contentedly at golden hour, tired and happy, warm smile",
    },
  ],
  go: [
    {
      text: () => `아침 해가 반짝 떠올랐어요.`,
      moment: () => "waking up brightly in morning light, stretching happily",
    },
    {
      text: (n, l) => `${withJosa(n, "은는")} ${l.label}에 갈 준비를 했어요.`,
      moment: () => "putting on a small backpack, ready to set off, excited",
    },
    {
      text: () => `가는 길이 참 즐거웠어요.`,
      moment: () =>
        "walking along a pleasant path, humming, birds and flowers nearby",
    },
    {
      text: (_n, l) => `${l.label}에 도착했어요!`,
      moment: () => "arriving at the entrance with arms wide open in delight",
    },
    {
      text: () => `오늘도 좋은 하루가 시작돼요.`,
      moment: () => "waving hello to friends, beaming, a bright new day",
    },
  ],
  read: [
    {
      text: (n, l) => `${withJosa(n, "은는")} ${l.label}에서 책을 펼쳤어요.`,
      moment: () => "opening a large colorful picture book, curious and eager",
    },
    {
      text: () => `친구들이 옆에 앉았어요.`,
      moment: () =>
        "two friendly kid characters sitting down close by to look at the book together",
    },
    {
      text: () => `함께 소리 내어 읽었어요.`,
      moment: () => "reading aloud together, mouths open mid-word, delighted",
    },
    {
      text: () => `이야기 속으로 쏙 빠져들었어요.`,
      moment: () =>
        "wide-eyed and absorbed, soft dreamy glow rising from the open book",
    },
    {
      text: () => `마지막 장을 덮으며 미소 지었어요.`,
      moment: () => "gently closing the book with a satisfied, peaceful smile",
    },
  ],
};

export const PAGES_PER_BOOK = 5;

/* ------------------------------------------------------------------ *
 * 조회 · 경로 규칙
 * ------------------------------------------------------------------ */

export const getCharacter = (id: string) =>
  CHARACTERS.find((c) => c.id === id) ?? null;
export const getAction = (id: string) => ACTIONS.find((a) => a.id === id) ?? null;
export const getLocation = (id: string) =>
  LOCATIONS.find((l) => l.id === id) ?? null;

/** 장면 폴더 이름. 파일 탐색기에서 사람이 읽을 수 있게 밑줄 두 개로 구분한다. */
export function comboId(
  character: CharacterId,
  action: ActionId,
  location: LocationId,
): string {
  return `${character}__${action}__${location}`;
}

/**
 * 앱이 이미지를 요청하는 URL. 서명이 없어 만료되지 않는다 — 책 스냅샷에 박혀
 * 영구 보존되기 때문이다. 인증은 proxy 의 세션 게이트가 담당한다.
 */
export function characterImageUrl(id: CharacterId): string {
  return `/api/make/img/characters/${id}`;
}
export function actionImageUrl(id: ActionId): string {
  return `/api/make/img/actions/${id}`;
}
export function locationImageUrl(id: LocationId): string {
  return `/api/make/img/locations/${id}`;
}
export function sceneImageUrl(
  character: CharacterId,
  action: ActionId,
  location: LocationId,
  page: number,
): string {
  return `/api/make/img/scenes/${comboId(character, action, location)}/${page}`;
}

/** 완성된 책의 제목. */
export function bookTitle(
  name: string,
  action: Action,
  location: Location,
): string {
  return `${name}의 ${location.label} ${action.titleWord}`;
}

/**
 * 채워야 할 그림 전체 목록 (STORAGE_DIR/make/ 기준 확장자 없는 상대 경로).
 * 프롬프트 문서 생성과 진행 상황 점검이 이 목록을 기준으로 삼는다.
 */
export function allImagePaths(): string[] {
  const out: string[] = [];
  for (const c of CHARACTERS) out.push(`characters/${c.id}`);
  for (const a of ACTIONS) out.push(`actions/${a.id}`);
  for (const l of LOCATIONS) out.push(`locations/${l.id}`);
  for (const c of CHARACTERS)
    for (const a of ACTIONS)
      for (const l of LOCATIONS)
        for (let p = 1; p <= PAGES_PER_BOOK; p++)
          out.push(`scenes/${comboId(c.id, a.id, l.id)}/${p}`);
  return out;
}
