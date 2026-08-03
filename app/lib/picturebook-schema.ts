/**
 * 그림책 프롬프트 팩(JSON)의 구조와 규칙.
 *
 * 두 경로가 이 파일을 공유한다 — 그림책지침 GPT 가 만들어 온 JSON 을 붙여넣는
 * 경로와, /story/design 에서 API 로 자동 설계하는 경로. 어느 쪽으로 들어오든
 * 같은 검사를 통과해야 채택된다.
 *
 * 구조는 picturebook.schema.json 을, 규칙은 prompt_examples_reference.md 를
 * 옮긴 것이다. 규칙 쪽이 중요하다 — 스키마는 모양만 맞추지만, 아래 검사들은
 * "그림이 이상하게 나왔던 실제 원인"을 생성 시점에 잡는다.
 *
 * 주의: 참조 문서 "2. 여백 작성 공식" 의 영어 좋은 예시 목록은 바로 위아래
 * 규칙과 모순된다(개별 prompt_en 에 "40 percent ... reserved for text" 를 쓰고
 * 있는데, 그건 금지 항목이다). 검증된 kapi_full.json 은 규칙 쪽을 따르므로
 * (15컷·표지 2장 모두 위반 0) 여기서도 규칙을 정본으로 삼는다.
 */

export type PbMeta = {
  title: string;
  source?: string;
  age: string;
  mood: string;
  theme?: PbTheme;
  message: string;
  workflow?: string;
  cut_count?: number;
  book_id?: string;
};

export const PB_THEMES = [
  "warm",
  "night",
  "forest",
  "ocean",
  "sunset",
  "candy",
] as const;
export type PbTheme = (typeof PB_THEMES)[number];

export type PbStyleBlock = {
  common: string;
  character_add?: string;
  scene_add?: string;
  cover_add?: string;
};

export type PbCharacter = {
  id: string;
  name_ko: string;
  role?: string;
  id_point: string;
  prompt_en: string;
};

export type PbCut = {
  no: number;
  ref: string[];
  camera: string;
  composition: string;
  expression: string;
  lighting?: string;
  background?: string;
  layout: string;
  prompt_en: string;
};

export type PbCover = {
  type: "front" | "back";
  ref: string[];
  title_area?: string;
  prompt_en: string;
};

export type PictureBook = {
  meta: PbMeta;
  style_block: PbStyleBlock;
  characters: PbCharacter[];
  cuts: PbCut[];
  covers: PbCover[];
};

/** 스키마가 허용하는 필드. 이 밖의 키가 오면 필드명 드리프트로 본다. */
const ALLOWED = {
  root: ["meta", "style_block", "characters", "cuts", "covers"],
  style_block: ["common", "character_add", "scene_add", "cover_add"],
  character: ["id", "name_ko", "role", "id_point", "prompt_en"],
  cut: [
    "no",
    "ref",
    "camera",
    "composition",
    "expression",
    "lighting",
    "background",
    "layout",
    "prompt_en",
  ],
  cover: ["type", "ref", "title_area", "prompt_en"],
} as const;

/** 자주 나오는 오필드 → 올바른 이름. 메시지로 바로 알려 주기 위한 표. */
const RENAMES: Record<string, string> = {
  scene_no: "no",
  scene_id: "no",
  name: "name_ko",
  emotion: "(빼기 — 감정은 prompt_en 에 녹인다)",
  text: "(빼기 — 한국어 본문은 JSON 에 넣지 않는다)",
};

export type Issue = {
  /** error 면 채택 불가, warn 이면 채택하되 알려 준다. */
  level: "error" | "warn";
  /** 어디서 났는지 — "cuts[3].prompt_en" 처럼. */
  path: string;
  message: string;
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && !!v.trim();

/* ------------------------------------------------------------------ *
 * 실패 모드 탐지 — 문서에 기록된 실전 사고들
 * ------------------------------------------------------------------ */

/** 개별 prompt_en 에 들어가면 그 영역이 평면 블록으로 잘린다. */
const PERCENT_RE = /\b\d+\s*(?:percent|%)/i;
/** 글자 언급은 scene_add·cover_add 한 곳에만. 개별 프롬프트에 있으면 과강조. */
const TEXT_BAN_RE = /\b(?:reserved for text|no letters|no text|no words|no captions|wordless)\b/i;
/** 단색 띠로 나오는 표현. "blankly" 같은 부사는 걸러야 하므로 경계를 좁게 잡는다. */
const FLAT_RE = /\b(?:blank(?:\s+(?:area|space))?|paper[- ]textured|empty space)\b/i;
/** 분할 화면을 부르는 별도 공간 지정. */
const SPLIT_RE = /\b(?:split screen|divided panel|separate room|another room|another aisle)\b/i;

/** 문서가 정한 5종 매핑. 그 외 값도 허용하되 경고만 남긴다. */
const KNOWN_CAMERAS = [
  "medium shot",
  "long shot",
  "extreme close-up",
  "low angle",
  "high angle",
];

function checkPromptEn(path: string, prompt: string, out: Issue[]) {
  if (PERCENT_RE.test(prompt)) {
    out.push({
      level: "error",
      path,
      message:
        '개별 prompt_en 에 퍼센트 표기가 있습니다. 모델이 그 영역을 평면 블록으로 잘라냅니다. 40% 확보는 style_block.scene_add 만트라가 담당합니다.',
    });
  }
  if (TEXT_BAN_RE.test(prompt)) {
    out.push({
      level: "error",
      path,
      message:
        '개별 prompt_en 에 글자 관련 문구가 있습니다. scene_add·cover_add 와 겹쳐 과강조되면 단색 띠가 나옵니다.',
    });
  }
  if (FLAT_RE.test(prompt)) {
    out.push({
      level: "error",
      path,
      message:
        'blank·paper-textured·empty space 는 여백을 단색으로 칠해 버립니다. "the same scene continues ... softening into a gentle out-of-focus blur" 형태로 쓰세요.',
    });
  }
  if (SPLIT_RE.test(prompt)) {
    out.push({
      level: "error",
      path,
      message: "별도 공간을 지정하면 화면이 두 쪽으로 갈라집니다(분할 화면).",
    });
  }
  if (prompt.trim().length < 120) {
    out.push({
      level: "warn",
      path,
      message: `${prompt.trim().length}자로 짧습니다. 검증된 본보기는 250~400자입니다.`,
    });
  }
}

function checkExtraKeys(
  path: string,
  obj: Record<string, unknown>,
  allowed: readonly string[],
  out: Issue[],
) {
  for (const key of Object.keys(obj)) {
    if (allowed.includes(key)) continue;
    const hint = RENAMES[key];
    out.push({
      level: "error",
      path: `${path}.${key}`,
      message: hint
        ? `스키마에 없는 필드입니다. → ${hint}`
        : "스키마에 없는 필드입니다.",
    });
  }
}

/* ------------------------------------------------------------------ *
 * 본 검사
 * ------------------------------------------------------------------ */

export function validatePictureBook(input: unknown): {
  ok: boolean;
  issues: Issue[];
  book: PictureBook | null;
} {
  const out: Issue[] = [];
  if (!isObj(input)) {
    return {
      ok: false,
      issues: [{ level: "error", path: "", message: "JSON 객체가 아닙니다." }],
      book: null,
    };
  }

  for (const key of ALLOWED.root) {
    if (!(key in input)) {
      out.push({ level: "error", path: key, message: "최상위 키가 없습니다." });
    }
  }
  checkExtraKeys("", input, ALLOWED.root, out);

  /* ---- meta ---- */
  const meta = input.meta;
  if (isObj(meta)) {
    for (const f of ["title", "age", "mood", "message"] as const) {
      if (!isStr(meta[f])) {
        out.push({ level: "error", path: `meta.${f}`, message: "필수 값입니다." });
      }
    }
    if (meta.theme !== undefined && !PB_THEMES.includes(meta.theme as PbTheme)) {
      out.push({
        level: "error",
        path: "meta.theme",
        message: `${PB_THEMES.join(" / ")} 중 하나여야 합니다.`,
      });
    }
  }

  /* ---- style_block ---- */
  const style = input.style_block;
  if (isObj(style)) {
    checkExtraKeys("style_block", style, ALLOWED.style_block, out);
    if (!isStr(style.common)) {
      out.push({
        level: "error",
        path: "style_block.common",
        message: "필수 값입니다.",
      });
    } else if (TEXT_BAN_RE.test(style.common)) {
      // 문서가 명시한 실전 실수 — scene_add 와 합쳐져 두 번 들어간다.
      out.push({
        level: "error",
        path: "style_block.common",
        message:
          "common 에 글자 금지 문구를 넣으면 scene_add 와 겹쳐 과강조됩니다. 글자 금지는 scene_add·cover_add 에만 두세요.",
      });
    }
    if (isStr(style.scene_add) && !PERCENT_RE.test(style.scene_add)) {
      out.push({
        level: "warn",
        path: "style_block.scene_add",
        message: "40% 여백 만트라가 보이지 않습니다. 여백 확보는 여기가 담당합니다.",
      });
    }
    if (isStr(style.character_add) && style.character_add.length > 220) {
      out.push({
        level: "warn",
        path: "style_block.character_add",
        message:
          "시트 레이아웃 수식만 담아야 합니다. 개별 외형 묘사는 characters[].prompt_en 에만 두세요.",
      });
    }
  }

  /* ---- characters ---- */
  const ids = new Set<string>();
  const chars = input.characters;
  if (!Array.isArray(chars) || chars.length === 0) {
    out.push({ level: "error", path: "characters", message: "최소 1명 필요합니다." });
  } else {
    chars.forEach((raw, i) => {
      const p = `characters[${i}]`;
      if (!isObj(raw)) {
        out.push({ level: "error", path: p, message: "객체가 아닙니다." });
        return;
      }
      checkExtraKeys(p, raw, ALLOWED.character, out);
      for (const f of ["id", "name_ko", "id_point", "prompt_en"] as const) {
        if (!isStr(raw[f])) {
          out.push({ level: "error", path: `${p}.${f}`, message: "필수 값입니다." });
        }
      }
      if (isStr(raw.id)) {
        if (!/^[a-z0-9_]+$/.test(raw.id)) {
          out.push({
            level: "error",
            path: `${p}.id`,
            message: "소문자 영문·숫자·언더스코어만 씁니다.",
          });
        }
        if (ids.has(raw.id)) {
          out.push({ level: "error", path: `${p}.id`, message: "id 가 중복됩니다." });
        }
        ids.add(raw.id);
      }
      if (isStr(raw.prompt_en)) {
        // 시트가 아니라 한 줄 묘사면 컷마다 얼굴이 달라진다.
        if (!/character reference sheet of/i.test(raw.prompt_en)) {
          out.push({
            level: "error",
            path: `${p}.prompt_en`,
            message: '"Character reference sheet of ..." 로 시작해야 합니다.',
          });
        }
        const views = ["front", "side", "back"].filter((v) =>
          new RegExp(`${v}\\s+view`, "i").test(raw.prompt_en as string),
        );
        if (views.length < 3) {
          out.push({
            level: "warn",
            path: `${p}.prompt_en`,
            message: "정면·측면·뒷면 뷰가 모두 보이지 않습니다.",
          });
        }
        if (!/expression/i.test(raw.prompt_en)) {
          out.push({
            level: "warn",
            path: `${p}.prompt_en`,
            message: "표정 close-up 요청이 보이지 않습니다.",
          });
        }
      }
    });
  }

  /* ---- cuts ---- */
  const cuts = input.cuts;
  if (!Array.isArray(cuts) || cuts.length === 0) {
    out.push({ level: "error", path: "cuts", message: "최소 1컷 필요합니다." });
  } else {
    let prevCamera = "";
    cuts.forEach((raw, i) => {
      const p = `cuts[${i}]`;
      if (!isObj(raw)) {
        out.push({ level: "error", path: p, message: "객체가 아닙니다." });
        return;
      }
      checkExtraKeys(p, raw, ALLOWED.cut, out);
      if (typeof raw.no !== "number" || raw.no < 1) {
        out.push({ level: "error", path: `${p}.no`, message: "1 이상의 정수여야 합니다." });
      } else if (raw.no !== i + 1) {
        out.push({
          level: "warn",
          path: `${p}.no`,
          message: `순서와 어긋납니다(${i + 1} 자리에 ${raw.no}).`,
        });
      }
      for (const f of ["camera", "composition", "expression", "layout", "prompt_en"] as const) {
        if (!isStr(raw[f])) {
          out.push({ level: "error", path: `${p}.${f}`, message: "필수 값입니다." });
        }
      }
      if (!Array.isArray(raw.ref) || raw.ref.length === 0) {
        out.push({ level: "error", path: `${p}.ref`, message: "등장인물 id 배열이 필요합니다." });
      } else {
        for (const r of raw.ref as unknown[]) {
          if (typeof r !== "string" || !ids.has(r)) {
            out.push({
              level: "error",
              path: `${p}.ref`,
              message: `characters 에 없는 id 입니다: ${String(r)}`,
            });
          }
        }
      }
      if (isStr(raw.camera)) {
        if (!KNOWN_CAMERAS.some((c) => (raw.camera as string).toLowerCase().includes(c))) {
          out.push({
            level: "warn",
            path: `${p}.camera`,
            message: `문서의 5종 매핑 밖입니다: "${raw.camera}"`,
          });
        }
        if (raw.camera === prevCamera && i > 0) {
          out.push({
            level: "warn",
            path: `${p}.camera`,
            message: "앞 컷과 같은 카메라가 연속됩니다.",
          });
        }
        prevCamera = raw.camera as string;
      }
      if (isStr(raw.layout)) {
        if (/비움|종이\s*톤|단색/.test(raw.layout)) {
          out.push({
            level: "error",
            path: `${p}.layout`,
            message: "단색 띠로 나오는 표현입니다. 풍경 요소가 이어지도록 쓰세요.",
          });
        }
        if (!/글\s*자리/.test(raw.layout)) {
          out.push({
            level: "warn",
            path: `${p}.layout`,
            message: '"(글 자리)" 표기가 없습니다.',
          });
        }
      }
      if (isStr(raw.prompt_en)) checkPromptEn(`${p}.prompt_en`, raw.prompt_en, out);
    });
  }

  /* ---- covers ---- */
  const covers = input.covers;
  if (!Array.isArray(covers) || covers.length === 0) {
    out.push({
      level: "error",
      path: "covers",
      message: "표지가 없습니다. 앞·뒤 두 장이 필요합니다.",
    });
  } else {
    const types = new Set<string>();
    covers.forEach((raw, i) => {
      const p = `covers[${i}]`;
      if (!isObj(raw)) {
        out.push({ level: "error", path: p, message: "객체가 아닙니다." });
        return;
      }
      checkExtraKeys(p, raw, ALLOWED.cover, out);
      if (raw.type !== "front" && raw.type !== "back") {
        out.push({ level: "error", path: `${p}.type`, message: 'front 또는 back 이어야 합니다.' });
      } else {
        types.add(raw.type);
      }
      if (!isStr(raw.prompt_en)) {
        out.push({ level: "error", path: `${p}.prompt_en`, message: "필수 값입니다." });
      } else {
        checkPromptEn(`${p}.prompt_en`, raw.prompt_en, out);
      }
      if (Array.isArray(raw.ref)) {
        for (const r of raw.ref as unknown[]) {
          if (typeof r !== "string" || !ids.has(r)) {
            out.push({
              level: "error",
              path: `${p}.ref`,
              message: `characters 에 없는 id 입니다: ${String(r)}`,
            });
          }
        }
      }
    });
    for (const t of ["front", "back"]) {
      if (!types.has(t)) {
        out.push({
          level: "error",
          path: "covers",
          message: `${t === "front" ? "앞" : "뒤"}표지가 없습니다.`,
        });
      }
    }
  }

  const ok = !out.some((i) => i.level === "error");
  return { ok, issues: out, book: ok ? (input as unknown as PictureBook) : null };
}

/** 연령대별 컷 수 기준 (지침의 "연령별 기준"). */
export const AGE_PRESETS = [
  { id: "4-5", label: "4~5세", cuts: [12, 16] as [number, number], defaultCuts: 14 },
  { id: "6-7", label: "6~7세", cuts: [15, 20] as [number, number], defaultCuts: 17 },
  { id: "8+", label: "8세 이상", cuts: [18, 24] as [number, number], defaultCuts: 20 },
] as const;

/** 컷 수가 연령 기준을 벗어나는지. 폼에서 즉시 알려 주는 용도. */
export function cutCountIssue(ageId: string, count: number): string | null {
  const preset = AGE_PRESETS.find((a) => a.id === ageId);
  if (!preset) return null;
  const [lo, hi] = preset.cuts;
  if (count < lo || count > hi) {
    return `${preset.label}는 보통 ${lo}~${hi}컷입니다.`;
  }
  return null;
}
