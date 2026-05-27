/**
 * Curated font catalog. The `family` value is the CSS font-family name we
 * declare via @font-face in globals.css. Keep `family` in sync with that.
 */
export type FontDef = {
  /** Korean label shown in pickers. */
  label: string;
  /** CSS font-family value. */
  family: string;
  /** Group label for sectioned pickers. */
  group: "기본" | "본문" | "제목" | "손글씨" | "영문";
  /** Optional bold weight default. */
  defaultWeight?: number | "normal" | "bold";
};

export const FONTS: FontDef[] = [
  // 기본
  { label: "페이퍼로지 (기본)", family: "Paperlogy", group: "기본", defaultWeight: 400 },

  // 본문
  { label: "프리텐다드", family: "Pretendard", group: "본문" },
  { label: "고운 도담", family: "GowunDodum", group: "본문" },
  { label: "프리젠테이션", family: "Freesentation", group: "본문" },
  { label: "아리따 부리", family: "AritaBuri", group: "본문" },
  { label: "리아 산스", family: "RiaSans", group: "본문" },
  { label: "고도 M", family: "GodoM", group: "본문" },
  { label: "MBC 1961 굴림", family: "MBC1961Gulim", group: "본문" },
  { label: "파셜 산스", family: "PartialSans", group: "본문" },

  // 제목
  { label: "검은 고딕", family: "BlackHanSans", group: "제목", defaultWeight: "bold" },
  { label: "학교안심 포스터B", family: "HakgyoansimPosterB", group: "제목", defaultWeight: "bold" },
  { label: "스웨거", family: "Swagger", group: "제목", defaultWeight: "bold" },
  { label: "카페24 써라운드", family: "Cafe24Ssurround", group: "제목", defaultWeight: "bold" },
  { label: "고도 B", family: "GodoB", group: "제목", defaultWeight: "bold" },
  { label: "윤 어린이재단 대한", family: "YoonChildfundkoreaDaeHan", group: "제목" },

  // 손글씨
  { label: "레시피코리아", family: "Recipekorea", group: "손글씨" },
  { label: "내 아리랑", family: "MYArirang", group: "손글씨" },
  { label: "창원단감 라운드", family: "ChangwonDangamRound", group: "손글씨" },
  { label: "오 츄이", family: "OhChewy", group: "손글씨" },

  // 영문
  { label: "Great Vibes (English)", family: "GreatVibes", group: "영문" },
  { label: "Luckiest Guy (English)", family: "LuckiestGuy", group: "영문" },
  { label: "Palladium (English)", family: "Palladium", group: "영문" },
  { label: "SF Pro (English)", family: "SFProDisplay", group: "영문" },
];

export const DEFAULT_FONT = FONTS[0]; // Paperlogy

/** Group fonts for sectioned dropdowns. */
export function groupFonts(): Array<{ group: FontDef["group"]; items: FontDef[] }> {
  const order: FontDef["group"][] = ["기본", "본문", "제목", "손글씨", "영문"];
  return order
    .map((g) => ({ group: g, items: FONTS.filter((f) => f.group === g) }))
    .filter((g) => g.items.length > 0);
}

/**
 * Ensure a font family is ready before Fabric.js draws text with it. Fabric
 * uses the platform canvas which can render with the wrong glyphs if the font
 * isn't loaded yet.
 */
export async function ensureFont(
  family: string,
  weight: number | string = 400,
  text = "abcABC가나다123",
): Promise<void> {
  if (typeof document === "undefined") return;
  try {
    await document.fonts.load(`${weight} 32px "${family}"`, text);
  } catch {
    // ignore — fall back to system glyphs
  }
}

/** Preload all curated fonts (called once when the editor mounts). */
export async function preloadAllFonts(): Promise<void> {
  if (typeof document === "undefined") return;
  await Promise.all(
    FONTS.map((f) =>
      ensureFont(f.family, f.defaultWeight ?? 400),
    ),
  );
}
