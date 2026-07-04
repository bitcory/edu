"use client";

/**
 * 스토리구성 — ported from tbstudy's "PRO 4단계 그림책 만들기" (step8) page.
 * A self-contained client tool: paste a GPT-produced picture-book JSON (or a
 * numbered script), parse/normalize it, and assemble copy-ready image-generation
 * prompts (character / cut / cover). No backend, DB, or AI calls — data lives in
 * a static sample file + localStorage. Styling is the kids palette (see
 * `.story-*` rules in globals.css). Editor hand-off is intentionally NOT wired
 * yet — this runs standalone.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Library, UsersRound, Clapperboard,
  Menu, FileInput, FolderOpen, X, BookOpen, ArrowLeft, Ruler,
  ExternalLink, MessageSquare, AudioLines, Music, Workflow, ScrollText, Wand2,
  ImagePlus, Sparkles, Square, Download,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  generateViaApi, generateViaChatGpt, isExtensionReady, getExtVersion,
  getGenEngine, setGenEngine,
  type Aspect, type Engine, type ExtEngine, type GenHandle,
} from "./imagegen";
import { buildBookPages } from "./handoff";
import { saveDraft } from "../lib/store";
import { PAGE_W } from "../lib/editor-types";
import {
  webtoonPreset, mergePromptParts, WEBTOON_NEGATIVE,
} from "./webtoon-styles";

const SAMPLE_URL = "/picbook/sample_library.json";
const CACHE_KEY = "toolb_step8_picbook_v1";
const SCRIPT_KEY = "toolb_step8_script_v1";
// 왼쪽 붙여넣기 원본(넘버링 포함)을 따로 저장 — 새로고침 후에도 원본이 그대로 보이도록.
const SCRIPT_INPUT_KEY = "toolb_step8_script_input_v1";

// 전체생성: 한 번에 동시 생성할 ChatGPT 탭 수. 1 = 순차 생성 — 동시에 여러 탭을
// 돌리면 ChatGPT가 봇으로 의심해 차단하므로 하나씩만 만든다. 각 작업은 확장이
// 띄우는 전용 창의 새 탭에서 돌고, 끝난 탭은 닫지 않아 결과를 확인할 수 있다.
const GEN_CONCURRENCY = 1;
// 탭이 한꺼번에 우르르 열리지 않도록 레인(동시 작업) 시작 시점을 이만큼 어긋나게 한다.
const GEN_STAGGER_MS = 2000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// 짧은 비암호화 해시(djb2) — Flow 소재 이름에 붙여 이미지 버전을 구분한다.
function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36).slice(0, 5);
}

// Compare dotted versions ("0.1.0"): -1 if a<b, 1 if a>b, 0 if equal. Used to
// detect an outdated self-distributed extension build.
function cmpVer(a: string, b: string): number {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

// 동시 `limit`개까지 worker 를 병렬 실행하는 작업 풀. 각 레인은 공유 큐에서 다음
// 인덱스를 가져와 처리하고, shouldStop() 이 true 면 새 작업을 더 시작하지 않는다.
// 레인 시작은 staggerMs 만큼 어긋나게 해서 탭이 동시에 폭주하지 않게 한다.
async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
  shouldStop: () => boolean,
  staggerMs = 0,
): Promise<void> {
  let next = 0;
  const lane = async () => {
    for (;;) {
      if (shouldStop()) return;
      const i = next++;
      if (i >= items.length) return;
      await worker(items[i], i);
    }
  };
  const lanes: Promise<void>[] = [];
  const laneCount = Math.min(limit, items.length);
  for (let k = 0; k < laneCount; k++) {
    if (k > 0 && staggerMs) await sleep(staggerMs);
    if (shouldStop()) break;
    lanes.push(lane());
  }
  await Promise.all(lanes);
}

// ---- data shapes (GPT output is loosely typed; keep fields optional) ----
type StoryChar = {
  id?: string;
  name_ko?: string;
  name?: string;
  role?: string;
  id_point?: string;
  prompt_en?: string;
  imageKey?: string; // R2 key of the generated/uploaded character image
  [k: string]: unknown;
};
type StoryCut = {
  no?: number | string;
  ref?: string[];
  emotion?: string;
  prompt_en?: string;
  type?: string;
  title_area?: string;
  imageKey?: string; // R2 key of the generated cut image
  [k: string]: unknown;
};
type StyleBlock = {
  common?: string;
  character_add?: string;
  scene_add?: string;
  cover_add?: string;
};
type BookMeta = {
  title?: string;
  source?: string;
  age?: string | number;
  mood?: string;
  theme?: string;
  message?: string;
};
type StoryBook = {
  meta?: BookMeta;
  characters?: StoryChar[];
  cuts?: StoryCut[];
  covers?: StoryCut[];
  style_block?: StyleBlock;
  [k: string]: unknown;
};
type StoryLib = {
  library_meta?: { name?: string; count?: number };
  books?: StoryBook[];
  [k: string]: unknown;
};
type PromptKind = "char" | "scene" | "cover";

const DOT_RULES: { rx: RegExp; color: string }[] = [
  { rx: /scarlet|콩쥐|다홍/, color: "#d6452f" },
  { rx: /purple|teal|팥쥐|보라/, color: "#6b5b95" },
  { rx: /grey|charcoal|소|ox/, color: "#5a5550" },
  { rx: /green|두꺼비|toad/, color: "#8aa05a" },
  { rx: /brown|참새|sparrow/, color: "#a9733f" },
  { rx: /yellow-star|다다|dada/, color: "#e0a32e" },
  { rx: /glow|moonlight|깜깜이|glim/, color: "#f3d674" },
  { rx: /black cat|까망|고양이|cat/, color: "#3a3742" },
];

function dotColor(c?: StoryChar | null): string {
  const t = (c?.id_point || "") + (c?.id || "");
  for (const { rx, color } of DOT_RULES) if (rx.test(t)) return color;
  return "#c9a14a";
}

function splitNegative(common?: string): { negative: string } {
  if (!common) return { negative: "" };
  const m = String(common).match(/(\bNo\s+text\b[\s\S]*?(?:wordless\s+illustration\.?|$))/i);
  return { negative: m ? m[1].trim() : "" };
}

function buildPrompt(book: StoryBook | null, base: string, kind: PromptKind): string {
  const sb = book?.style_block || {};
  const add =
    kind === "char" ? (sb.character_add ? " " + sb.character_add : "") :
    kind === "cover" ? (sb.cover_add ? " " + sb.cover_add : "") :
    (sb.scene_add ? " " + sb.scene_add : "");
  const { negative } = splitNegative(sb.common);
  return base + add + (negative ? " " + negative : "");
}

function escapeId(s?: string): string {
  return String(s || "");
}

// Covers are generated with the cover prompt + the parsed full script + an
// instruction, on top of the attached reference character images. The 3:4
// aspect instruction is appended at the generation layer (withAspectInstruction
// in imagegen.ts), so it isn't repeated here.
function buildCoverPrompt(book: StoryBook | null, cover: StoryCut, scriptText: string): string {
  const base = buildPrompt(book, cover.prompt_en || "", "cover");
  const label = cover.type === "front" ? "앞표지" : cover.type === "back" ? "뒷표지" : "표지";
  const parts = [base];
  const s = (scriptText || "").trim();
  if (s) parts.push(s);
  parts.push(`첨부된 프롬프트, 대본, 이미지를 바탕으로 그림책 ${label}의 이미지를 만들어줘`);
  return parts.join("\n\n");
}

function parseScript(text: string): string {
  if (!text) return "";
  // 1, 1., 1), [1], (1), <1>, 1: 같은 단독 넘버링 라벨을 인식
  const onlyNum = /^(?:\[\s*\d+\s*\]|\(\s*\d+\s*\)|<\s*\d+\s*>|\d+\s*[.):]?)$/;
  const inlineNum = /^(?:\[\s*\d+\s*\]|\(\s*\d+\s*\)|<\s*\d+\s*>|\d+\s*[.):])\s*/;
  const cleaned = String(text)
    .split("\n")
    .filter((ln) => !onlyNum.test(ln.trim()))
    .join("\n");
  const blocks = cleaned.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  const scenes = blocks.map((b) => b.replace(inlineNum, ""));
  return scenes.join("\n\n");
}

// v6.2 GPT 출력은 버전마다 필드가 다르다. 책 단위로 정규화해 신·구 스키마를 모두 지원한다.
//  - 샷 번호: no / scene_no / cut_no / shot_no → 없으면 배열 순서로 자동 부여
//  - 캐릭터 한글이름: name_ko / name
//  - 등장 인물(ref): 없으면 컷 텍스트에서 캐릭터 id·이름을 스캔해 추론
// 웹툰 페이지/패널 포맷 → 컷 기반 그림책 포맷 어댑터.
// 다른 파이프라인이 내보내는 { title, logline, style_set, characters[ref_prompt],
// pages[{ image_prompt, panels[...] }] } 형태를 이 화면이 읽는 { meta, characters
// [prompt_en], cuts[prompt_en] }로 매핑한다. 9:16 페이지 1장 = 컷 1개.
type CutNarration = { id?: string; text?: string; [k: string]: unknown };
type CutBubble = {
  id?: string;
  type?: string; // dialogue | thought
  speaker?: string; // character id
  text?: string;
  x?: number;
  y?: number;
  [k: string]: unknown;
};
type WebtoonPanel = {
  position?: string;
  scene?: string;
  narration?: CutNarration[];
  bubbles?: CutBubble[];
  [k: string]: unknown;
};
type WebtoonPage = {
  page?: number;
  tone?: string;
  ref?: string[];
  image_prompt?: string;
  panels?: WebtoonPanel[];
  [k: string]: unknown;
};

// 컷(=페이지)에 보존된 panels 를 타입 있게 읽는다 (런타임에 어댑터가 붙임).
function cutPanels(cut: StoryCut): WebtoonPanel[] {
  const p = (cut as { panels?: WebtoonPanel[] }).panels;
  return Array.isArray(p) ? p : [];
}
// 페이지 전체 말풍선을 패널 순서대로 모은다 ([BUBBLE_1], [BUBBLE_2] … 순).
function cutBubbles(cut: StoryCut): CutBubble[] {
  return cutPanels(cut).flatMap((p) => p.bubbles || []);
}
// 컷에 편집할 대사/내레이션이 하나라도 있는지.
function cutHasText(cut: StoryCut): boolean {
  return cutPanels(cut).some(
    (p) => (p.narration?.length || 0) + (p.bubbles?.length || 0) > 0,
  );
}
// 웹툰(세로 9:16) 책인지. 어댑터가 붙인 webtoon 플래그 또는 컷의 panels 로 판별.
function isWebtoonBook(book: StoryBook | null): boolean {
  if (!book) return false;
  if ((book as { webtoon?: unknown }).webtoon === true) return true;
  return (book.cuts || []).some((c) => cutPanels(c).length > 0);
}
// image_prompt 의 [BUBBLE_n] 자리표시자를 해당 말풍선 text 로 치환한다.
// (지침 6번: 웹페이지가 [BUBBLE_n] → bubbles[n-1].text. 텍스트 단일 출처)
function substituteBubbles(text: string, cut: StoryCut): string {
  const bubbles = cutBubbles(cut);
  if (!bubbles.length || !text) return text;
  let out = text;
  bubbles.forEach((b, i) => {
    const t = (b?.text || "").trim();
    const re = new RegExp(`\\[BUBBLE_?${i + 1}\\]`, "g");
    // 빈 텍스트면 자리표시자만 제거(빈 말풍선 유지).
    out = out.replace(re, t);
  });
  return out;
}
function adaptStoryBook(b: StoryBook): StoryBook {
  const pages = (b as { pages?: WebtoonPage[] }).pages;
  // 이미 컷 기반이거나 pages가 없으면 그대로 둔다.
  if (!Array.isArray(pages) || (Array.isArray(b.cuts) && b.cuts.length)) return b;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const meta: BookMeta = {
    ...(b.meta || {}),
    title: b.meta?.title ?? str(b.title),
    theme: b.meta?.theme ?? str(b.theme),
    message: b.meta?.message ?? str(b.logline),
  };
  // style_set 으로 프리셋을 찾아 art_style·tone·safety·negative 를 "빠진 것만" 보강
  // 병합한다(중복 방지). 프리셋을 못 찾으면 원본 프롬프트를 그대로 둔다.
  const preset = webtoonPreset(str(b.style_set));
  const art = preset?.art_style;
  const safety = preset?.safety_context;

  const characters: StoryChar[] = (b.characters || []).map((c) => {
    const baseCh = c.prompt_en ?? str(c.ref_prompt) ?? "";
    return {
      ...c,
      // 캐릭터 시트엔 art_style·safety 만 보강(톤·negative 는 시트에 부적합).
      prompt_en: preset ? mergePromptParts(baseCh, [art, safety]) : baseCh,
    };
  });

  const cuts: StoryCut[] = pages.map((p, i) => {
    const toneStr = typeof p.tone === "string" ? p.tone : undefined;
    const tonePrompt = toneStr ? preset?.tones?.[toneStr]?.prompt : undefined;
    const baseCut = p.image_prompt ?? "";
    return {
      no: p.page ?? i + 1,
      ref: Array.isArray(p.ref) ? p.ref : [],
      prompt_en: preset
        ? mergePromptParts(baseCut, [art, tonePrompt, safety, WEBTOON_NEGATIVE])
        : baseCut,
      type: "scene",
      tone: p.tone,
      // 패널 장면 설명을 합쳐 ref 추론/표시에 활용 (나레이션·말풍선은 보존만).
      scene: (p.panels || []).map((pn) => pn.scene).filter(Boolean).join(" / "),
      panels: p.panels,
    };
  });
  // 세로 웹툰 책 표시 → 컷 이미지를 9:16 으로 생성하게 한다.
  return { ...b, meta, characters, cuts, webtoon: true };
}

function normalizeBook(bIn: StoryBook): StoryBook {
  if (!bIn || typeof bIn !== "object") return bIn;
  const b = adaptStoryBook(bIn);
  const characters: StoryChar[] = (b.characters || []).map((c) => ({
    ...c,
    name_ko: c.name_ko ?? c.name ?? c.id,
  }));
  const escapeRe = (s: string) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const charTerms = characters.map((c) => ({
    id: c.id,
    terms: [c.id, c.name_ko, c.name].filter(Boolean).map((t) => String(t).toLowerCase()),
  }));
  const inferRef = (item: StoryCut): string[] => {
    const hay = [item.prompt_en, item.composition, item.expression, item.background,
      item.text, item.scene, item.character_position].filter(Boolean).join(" ").toLowerCase();
    return charTerms
      .filter(({ terms }) => terms.some((t) =>
        /^[\x00-\x7f]+$/.test(t) ? new RegExp(`\\b${escapeRe(t)}\\b`).test(hay) : hay.includes(t)))
      .map(({ id }) => id)
      .filter((id): id is string => Boolean(id));
  };
  const fix = (item: StoryCut, i: number): StoryCut => ({
    ...item,
    no: (item.no ?? item.scene_no ?? item.cut_no ?? item.shot_no ?? (i + 1)) as string | number,
    ref: (Array.isArray(item.ref) && item.ref.length) ? item.ref : inferRef(item),
  });
  return {
    ...b,
    characters,
    cuts: (b.cuts || []).map(fix),
    covers: (b.covers || []).map(fix),
  };
}

function charKeyOf(bookIdx: number, c: StoryChar, idx: number): string {
  return `${bookIdx}:${c.id ?? idx}`;
}

function cutKeyOf(bookIdx: number, cut: StoryCut, idx: number): string {
  return `${bookIdx}:cut:${cut.no ?? idx}`;
}

function coverKeyOf(bookIdx: number, cover: StoryCut, idx: number): string {
  return `${bookIdx}:cover:${cover.type ?? idx}`;
}

function normalizeLib(obj: StoryLib | StoryBook | null): StoryLib | null {
  if (!obj) return null;
  const lib: StoryLib = (obj as StoryLib).books
    ? (obj as StoryLib)
    : { library_meta: { name: "우리 그림책 서재" }, books: [obj as StoryBook] };
  return { ...lib, books: (lib.books || []).map(normalizeBook) };
}

export default function StoryPage() {
  const router = useRouter();
  const [sendBusy, setSendBusy] = useState(false);
  const [lib, setLib] = useState<StoryLib | null>(null);
  const [bookIdx, setBookIdx] = useState(0);
  const [section, setSection] = useState<"chars" | "cuts">("chars");
  const [activeChar, setActiveChar] = useState(0);
  const [cutFilter, setCutFilter] = useState<string | number>("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonErr, setJsonErr] = useState("");
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [scriptInput, setScriptInput] = useState("");
  const [scriptPreview, setScriptPreview] = useState("");
  const [scriptParsed, setScriptParsed] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  // Per-character image display URLs, keyed by `${bookIdx}:${charId}`.
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  // Per-cut image display URLs, keyed by `${bookIdx}:cut:${cutNo}`.
  const [cutImageUrls, setCutImageUrls] = useState<Record<string, string>>({});
  // Per-cover image display URLs, keyed by `${bookIdx}:cover:${type}`.
  const [coverImageUrls, setCoverImageUrls] = useState<Record<string, string>>({});
  const modalFileRef = useRef<HTMLInputElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 초기 로드: localStorage 캐시가 있으면 그것을, 없으면 샘플을 fetch.
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const obj = JSON.parse(cached);
        // Hydrate from localStorage on mount — must run client-side (not a lazy
        // initializer) to avoid an SSR hydration mismatch.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLib(normalizeLib(obj));
        return;
      }
    } catch {}
    fetch(SAMPLE_URL)
      .then((r) => r.json())
      .then((obj) => setLib(normalizeLib(obj)))
      .catch(() => setLib(null));
  }, []);

  // 저장된 본문 대본 복원 — 새로고침 후에도 유지된다.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SCRIPT_KEY);
      if (saved) {
        // Restore the saved script on mount (client-side hydration, see above).
        // 왼쪽 붙여넣기 칸은 원본(넘버링 포함)을 복원한다. 원본 키가 없으면(구버전
        // 저장본) 파싱본으로 폴백한다.
        const savedInput = localStorage.getItem(SCRIPT_INPUT_KEY);
        /* eslint-disable react-hooks/set-state-in-effect */
        setScriptParsed(saved);
        setScriptPreview(saved);
        setScriptInput(savedInput ?? saved);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {}
  }, []);

  const book = lib?.books?.[bookIdx] || null;

  const charMap = useMemo(() => {
    const m: Record<string, StoryChar> = {};
    (book?.characters || []).forEach((c) => { if (c.id) m[c.id] = c; });
    return m;
  }, [book]);

  // Upload a generated/uploaded image to R2, show it for THIS character only,
  // and persist its key on the character in the lib (localStorage).
  const handleCharImage = useCallback(async (activeIdx: number, dataUrl: string) => {
    const cc = lib?.books?.[bookIdx]?.characters?.[activeIdx];
    if (!cc) return;
    const ck = charKeyOf(bookIdx, cc, activeIdx);
    setImageUrls((m) => ({ ...m, [ck]: dataUrl })); // optimistic (instant)
    try {
      const r = await fetch("/api/story/save-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.key) return; // keep the optimistic data URL on failure
      setImageUrls((m) => ({ ...m, [ck]: d.url || dataUrl }));
      setLib((prev) => {
        if (!prev?.books) return prev;
        const books = [...prev.books];
        const bk = books[bookIdx];
        if (!bk) return prev;
        const characters = [...(bk.characters || [])];
        const target = characters[activeIdx];
        if (!target) return prev;
        characters[activeIdx] = { ...target, imageKey: d.key };
        books[bookIdx] = { ...bk, characters };
        const next = { ...prev, books };
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    } catch {
      /* keep optimistic data URL */
    }
  }, [lib, bookIdx]);

  // Same as handleCharImage but for a cut (stores cut.imageKey).
  const handleCutImage = useCallback(async (cutIdx: number, dataUrl: string) => {
    const cc = lib?.books?.[bookIdx]?.cuts?.[cutIdx];
    if (!cc) return;
    const ck = cutKeyOf(bookIdx, cc, cutIdx);
    setCutImageUrls((m) => ({ ...m, [ck]: dataUrl }));
    try {
      const r = await fetch("/api/story/save-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.key) return;
      setCutImageUrls((m) => ({ ...m, [ck]: d.url || dataUrl }));
      setLib((prev) => {
        if (!prev?.books) return prev;
        const books = [...prev.books];
        const bk = books[bookIdx];
        if (!bk) return prev;
        const cuts = [...(bk.cuts || [])];
        const target = cuts[cutIdx];
        if (!target) return prev;
        cuts[cutIdx] = { ...target, imageKey: d.key };
        books[bookIdx] = { ...bk, cuts };
        const next = { ...prev, books };
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    } catch {
      /* keep optimistic data URL */
    }
  }, [lib, bookIdx]);

  // 컷의 말풍선/내레이션 편집을 상태에 반영(immutable + localStorage). normalize 는
  // 로드 때만 도므로 여기서 panels 를 직접 써도 덮어쓰이지 않는다.
  const handleCutPanels = useCallback((cutIdx: number, panels: WebtoonPanel[]) => {
    setLib((prev) => {
      if (!prev?.books) return prev;
      const books = [...prev.books];
      const bk = books[bookIdx];
      if (!bk) return prev;
      const cuts = [...(bk.cuts || [])];
      const target = cuts[cutIdx];
      if (!target) return prev;
      cuts[cutIdx] = { ...target, panels } as StoryCut;
      books[bookIdx] = { ...bk, cuts };
      const next = { ...prev, books };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [bookIdx]);

  // Same as handleCutImage but for a cover (stores cover.imageKey).
  const handleCoverImage = useCallback(async (coverIdx: number, dataUrl: string) => {
    const cc = lib?.books?.[bookIdx]?.covers?.[coverIdx];
    if (!cc) return;
    const ck = coverKeyOf(bookIdx, cc, coverIdx);
    setCoverImageUrls((m) => ({ ...m, [ck]: dataUrl }));
    try {
      const r = await fetch("/api/story/save-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.key) return;
      setCoverImageUrls((m) => ({ ...m, [ck]: d.url || dataUrl }));
      setLib((prev) => {
        if (!prev?.books) return prev;
        const books = [...prev.books];
        const bk = books[bookIdx];
        if (!bk) return prev;
        const covers = [...(bk.covers || [])];
        const target = covers[coverIdx];
        if (!target) return prev;
        covers[coverIdx] = { ...target, imageKey: d.key };
        books[bookIdx] = { ...bk, covers };
        const next = { ...prev, books };
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    } catch {
      /* keep optimistic data URL */
    }
  }, [lib, bookIdx]);

  // Resolve a cut's reference character images (for image-to-image) into data
  // URLs, plus a stable per-image asset name. Flow 엔진은 이 이름으로 소재
  // 라이브러리에 1회만 업로드하고 컷마다 등장 캐릭터만 골라 재첨부한다(인물매칭).
  // 이름에 imageKey 해시를 붙여, 캐릭터 이미지를 다시 만들면 새 소재로 올라간다.
  const resolveCutRefs = useCallback(async (cut: StoryCut): Promise<{ images: string[]; names: string[]; missing: number }> => {
    const refIds = Array.isArray(cut.ref) ? cut.ref : [];
    const chars = lib?.books?.[bookIdx]?.characters || [];
    const keys: string[] = [];
    const names: string[] = [];
    let missing = 0;
    for (const id of refIds) {
      const c = chars.find((x) => x.id === id);
      if (c && typeof c.imageKey === "string") {
        keys.push(c.imageKey);
        const base = (c.name_ko || c.id || "char").toString().slice(0, 16);
        names.push(`${base}_${shortHash(c.imageKey)}`);
      } else missing++;
    }
    if (!keys.length) return { images: [], names: [], missing };
    try {
      const r = await fetch("/api/story/image-data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keys }),
      });
      const d = await r.json().catch(() => ({}));
      const images: string[] = [];
      const outNames: string[] = [];
      keys.forEach((k, i) => {
        const u = d.dataUrls?.[k];
        if (u) { images.push(u); outNames.push(names[i]); }
      });
      return { images, names: outNames, missing };
    } catch {
      return { images: [], names: [], missing: refIds.length };
    }
  }, [lib, bookIdx]);

  // Refresh presigned display URLs for any stored character + cut image keys.
  useEffect(() => {
    const keys: string[] = [];
    const charByCk: Record<string, string> = {};
    const cutByCk: Record<string, string> = {};
    const coverByCk: Record<string, string> = {};
    (lib?.books || []).forEach((b, bi) => {
      (b.characters || []).forEach((c, ci) => {
        if (typeof c.imageKey === "string" && c.imageKey) {
          keys.push(c.imageKey);
          charByCk[charKeyOf(bi, c, ci)] = c.imageKey;
        }
      });
      (b.cuts || []).forEach((cut, ci) => {
        if (typeof cut.imageKey === "string" && cut.imageKey) {
          keys.push(cut.imageKey);
          cutByCk[cutKeyOf(bi, cut, ci)] = cut.imageKey;
        }
      });
      (b.covers || []).forEach((cv, ci) => {
        if (typeof cv.imageKey === "string" && cv.imageKey) {
          keys.push(cv.imageKey);
          coverByCk[coverKeyOf(bi, cv, ci)] = cv.imageKey;
        }
      });
    });
    if (!keys.length) return;
    let alive = true;
    fetch("/api/story/image-urls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keys }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.urls) return;
        setImageUrls((m) => {
          const next = { ...m };
          for (const ck in charByCk) { const u = d.urls[charByCk[ck]]; if (u) next[ck] = u; }
          return next;
        });
        setCutImageUrls((m) => {
          const next = { ...m };
          for (const ck in cutByCk) { const u = d.urls[cutByCk[ck]]; if (u) next[ck] = u; }
          return next;
        });
        setCoverImageUrls((m) => {
          const next = { ...m };
          for (const ck in coverByCk) { const u = d.urls[coverByCk[ck]]; if (u) next[ck] = u; }
          return next;
        });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [lib]);

  // Helper-extension presence (gates 전체생성, which uses the extension engines).
  const [extReady, setExtReady] = useState(false);
  useEffect(() => {
    let a = true;
    isExtensionReady().then((r) => { if (a) setExtReady(r); });
    return () => { a = false; };
  }, []);

  // 생성 엔진(ChatGPT/Flow) — localStorage 에 저장되고 모든 생성 버튼(단건/전체)에
  // 적용된다. generateViaChatGpt 가 호출 시점에 현재 값을 읽는다.
  const [genEngine, setGenEngineState] = useState<ExtEngine>("chatgpt");
  useEffect(() => { setGenEngineState(getGenEngine()); }, []);
  const pickEngine = (e: ExtEngine) => { setGenEngine(e); setGenEngineState(e); };

  // The extension is self-distributed (no Chrome Web Store / no auto-update), so
  // warn when the installed build is older than the latest one we ship.
  const [extUpdate, setExtUpdate] = useState<{ installed: string; latest: string; downloadUrl: string } | null>(null);
  useEffect(() => {
    let a = true;
    (async () => {
      const installed = await getExtVersion();
      if (!a || !installed) return; // extension not present → nothing to nag about
      const latest: { version?: string; downloadUrl?: string } = await fetch("/api/ext/latest")
        .then((r) => r.json())
        .catch(() => ({}));
      if (!a || !latest.version) return;
      if (cmpVer(installed, latest.version) < 0) {
        setExtUpdate({ installed, latest: latest.version, downloadUrl: latest.downloadUrl || "" });
      }
    })();
    return () => { a = false; };
  }, []);

  // 전체생성: generate an image for every item that doesn't have one yet, up to
  // GEN_CONCURRENCY at once (each job runs in its own fresh ChatGPT tab, so they
  // don't collide). In-flight handles are tracked in a Set so 정지 cancels all.
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");
  const [zipBusy, setZipBusy] = useState(false);
  const [cutBulkBusy, setCutBulkBusy] = useState(false);
  const [cutBulkStatus, setCutBulkStatus] = useState("");
  const [cutZipBusy, setCutZipBusy] = useState(false);
  const cutBulkCancel = useRef(false);
  const cutBulkHandles = useRef<Set<GenHandle>>(new Set());
  const bulkCancel = useRef(false);
  const bulkHandles = useRef<Set<GenHandle>>(new Set());

  async function generateAll() {
    const list = lib?.books?.[bookIdx]?.characters || [];
    if (!list.length || bulkBusy) return;
    bulkCancel.current = false;
    bulkHandles.current.clear();
    setBulkBusy(true);
    const total = list.length;
    let made = 0;
    let done = 0;
    // Flow 는 탭 하나의 큐가 30%/80% 파이프라인으로 처리하므로 2개까지 미리 보낸다.
    const flowEng = getGenEngine() === "flow";
    await runPool(list, flowEng ? 2 : GEN_CONCURRENCY, async (c, i) => {
      const ck = charKeyOf(bookIdx, c, i);
      const name = (c.name_ko || c.id || `#${i + 1}`).toString();
      if (imageUrls[ck] || typeof c.imageKey === "string") {
        done++;
        setBulkStatus(`${done}/${total} · ${name} 건너뜀 (이미 있음)`);
        return;
      }
      const prompt = buildPrompt(lib?.books?.[bookIdx] || null, c.prompt_en || "", "char");
      if (!prompt.trim()) { done++; setBulkStatus(`${done}/${total} · ${name} 건너뜀 (프롬프트 없음)`); return; }
      setBulkStatus(`${done}/${total} · ${name} 생성 중…`);
      try {
        const handle = generateViaChatGpt({
          prompt,
          aspect: "16:9",
          onProgress: (m) => setBulkStatus(`${done}/${total} · ${name}: ${m}`),
        });
        bulkHandles.current.add(handle);
        try {
          const dataUrl = await handle.promise;
          await handleCharImage(i, dataUrl);
          made++;
        } finally {
          bulkHandles.current.delete(handle);
        }
      } catch (e) {
        setBulkStatus(`${done}/${total} · ${name} 실패: ${(e as Error)?.message || ""}`);
      } finally {
        done++;
      }
    }, () => bulkCancel.current, flowEng ? 500 : GEN_STAGGER_MS);
    setBulkBusy(false);
    setBulkStatus(bulkCancel.current ? `중지됨 · ${made}장 생성` : `완료 · ${made}장 생성`);
  }

  function cancelBulk() {
    bulkCancel.current = true;
    bulkHandles.current.forEach((h) => h.cancel());
    bulkHandles.current.clear();
  }

  async function downloadAllZip() {
    if (zipBusy) return;
    const list = lib?.books?.[bookIdx]?.characters || [];
    const items = list
      .map((c, i) => ({
        key: typeof c.imageKey === "string" ? c.imageKey : "",
        name: (c.name_ko || c.id || `character_${i + 1}`).toString(),
      }))
      .filter((x) => x.key);
    if (!items.length) { showToast("저장된 이미지가 없어요"); return; }
    setZipBusy(true);
    try {
      const r = await fetch("/api/story/download-zip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!r.ok) { showToast("ZIP 생성 실패"); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${lib?.books?.[bookIdx]?.meta?.title || "characters"}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`ZIP 다운로드 시작! (${items.length}장)`);
    } catch {
      showToast("ZIP 다운로드 실패");
    } finally {
      setZipBusy(false);
    }
  }

  // 본문 컷 전체생성 — image-to-image: each cut uses its ref characters' images.
  // Cuts first (up to GEN_CONCURRENCY in parallel), then covers.
  async function generateAllCuts() {
    const book0 = lib?.books?.[bookIdx] || null;
    const list = book0?.cuts || [];
    const coverList = book0?.covers || [];
    if ((!list.length && !coverList.length) || cutBulkBusy) return;
    cutBulkCancel.current = false;
    cutBulkHandles.current.clear();
    setCutBulkBusy(true);
    const webtoon = isWebtoonBook(book0);
    const total = list.length + coverList.length;
    let made = 0;
    let done = 0;
    const stop = () => cutBulkCancel.current;
    // Flow 는 탭 하나의 큐가 30%/80% 파이프라인으로 처리하므로 2개까지 미리 보낸다.
    const flowEng = getGenEngine() === "flow";
    const conc = flowEng ? 2 : GEN_CONCURRENCY;
    const stagger = flowEng ? 500 : GEN_STAGGER_MS;

    await runPool(list, conc, async (cut, i) => {
      const ck = cutKeyOf(bookIdx, cut, i);
      const label = `컷 ${cut.no ?? i + 1}`;
      if (cutImageUrls[ck] || typeof cut.imageKey === "string") {
        done++;
        setCutBulkStatus(`${done}/${total} · ${label} 건너뜀 (이미 있음)`);
        return;
      }
      const prompt = buildPrompt(book0, substituteBubbles(cut.prompt_en || "", cut), "scene");
      if (!prompt.trim()) { done++; setCutBulkStatus(`${done}/${total} · ${label} 건너뜀 (프롬프트 없음)`); return; }
      setCutBulkStatus(`${done}/${total} · ${label} 참조 준비 중…`);
      try {
        const refs = await resolveCutRefs(cut);
        const note = refs.missing ? ` (참조 ${refs.images.length}/없음 ${refs.missing})` : ` (참조 ${refs.images.length})`;
        const handle = generateViaChatGpt({
          prompt,
          aspect: webtoon ? "9:16" : "16:9",
          referenceImages: refs.images,
          referenceNames: refs.names,
          onProgress: (m) => setCutBulkStatus(`${done}/${total} · ${label}${note}: ${m}`),
        });
        cutBulkHandles.current.add(handle);
        try {
          const dataUrl = await handle.promise;
          await handleCutImage(i, dataUrl);
          made++;
        } finally {
          cutBulkHandles.current.delete(handle);
        }
      } catch (e) {
        setCutBulkStatus(`${done}/${total} · ${label} 실패: ${(e as Error)?.message || ""}`);
      } finally {
        done++;
      }
    }, stop, stagger);

    // Covers next — image-to-image at 3:4 (front/back cover ratio).
    await runPool(coverList, conc, async (cv, i) => {
      const ck = coverKeyOf(bookIdx, cv, i);
      const label = cv.type === "front" ? "앞표지" : cv.type === "back" ? "뒤표지" : `표지 ${i + 1}`;
      if (coverImageUrls[ck] || typeof cv.imageKey === "string") {
        done++;
        setCutBulkStatus(`${done}/${total} · ${label} 건너뜀 (이미 있음)`);
        return;
      }
      const prompt = buildCoverPrompt(book0, cv, scriptParsed);
      if (!prompt.trim()) { done++; setCutBulkStatus(`${done}/${total} · ${label} 건너뜀 (프롬프트 없음)`); return; }
      setCutBulkStatus(`${done}/${total} · ${label} 참조 준비 중…`);
      try {
        const refs = await resolveCutRefs(cv);
        const note = refs.missing ? ` (참조 ${refs.images.length}/없음 ${refs.missing})` : ` (참조 ${refs.images.length})`;
        const handle = generateViaChatGpt({
          prompt,
          aspect: "3:4",
          referenceImages: refs.images,
          referenceNames: refs.names,
          onProgress: (m) => setCutBulkStatus(`${done}/${total} · ${label}${note}: ${m}`),
        });
        cutBulkHandles.current.add(handle);
        try {
          const dataUrl = await handle.promise;
          await handleCoverImage(i, dataUrl);
          made++;
        } finally {
          cutBulkHandles.current.delete(handle);
        }
      } catch (e) {
        setCutBulkStatus(`${done}/${total} · ${label} 실패: ${(e as Error)?.message || ""}`);
      } finally {
        done++;
      }
    }, stop, stagger);

    setCutBulkBusy(false);
    setCutBulkStatus(cutBulkCancel.current ? `중지됨 · ${made}장 생성` : `완료 · ${made}장 생성`);
  }

  function cancelCutBulk() {
    cutBulkCancel.current = true;
    cutBulkHandles.current.forEach((h) => h.cancel());
    cutBulkHandles.current.clear();
  }

  async function downloadAllCutsZip() {
    if (cutZipBusy) return;
    const bk = lib?.books?.[bookIdx];
    const cutItems = (bk?.cuts || []).map((cut, i) => ({
      key: typeof cut.imageKey === "string" ? cut.imageKey : "",
      name: `cut_${cut.no ?? i + 1}`,
    }));
    const coverItems = (bk?.covers || []).map((cv, i) => ({
      key: typeof cv.imageKey === "string" ? cv.imageKey : "",
      name: `cover_${cv.type || i + 1}`,
    }));
    const items = [...cutItems, ...coverItems].filter((x) => x.key);
    if (!items.length) { showToast("저장된 컷/표지 이미지가 없어요"); return; }
    setCutZipBusy(true);
    try {
      const r = await fetch("/api/story/download-zip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!r.ok) { showToast("ZIP 생성 실패"); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${lib?.books?.[bookIdx]?.meta?.title || "cuts"}_cuts.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`ZIP 다운로드 시작! (${items.length}장)`);
    } catch {
      showToast("ZIP 다운로드 실패");
    } finally {
      setCutZipBusy(false);
    }
  }

  // 책만들기로 보내기 — front cover → cover page, cuts → content (1쪽~),
  // back cover → last page. Reuses the editor's "전체추가" page structure.
  async function sendToEditor() {
    if (sendBusy) return;
    const bk = lib?.books?.[bookIdx];
    if (!bk) return;
    const frontKey = (bk.covers || []).find((c) => c.type === "front")?.imageKey;
    const backKey = (bk.covers || []).find((c) => c.type === "back")?.imageKey;
    const cutKeys = (bk.cuts || [])
      .map((c) => (typeof c.imageKey === "string" ? c.imageKey : ""))
      .filter(Boolean);
    if (!cutKeys.length && !frontKey) {
      showToast("먼저 이미지를 생성하세요");
      return;
    }
    setSendBusy(true);
    showToast("책만들기로 보내는 중…");
    try {
      const allKeys = [frontKey, ...cutKeys, backKey].filter(Boolean) as string[];
      const r = await fetch("/api/story/image-data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keys: allKeys }),
      });
      const d = await r.json().catch(() => ({}));
      const map: Record<string, string> = d.dataUrls || {};
      const front = frontKey ? map[frontKey] : undefined;
      const back = backKey ? map[backKey] : undefined;
      const cuts = cutKeys.map((k) => map[k]).filter(Boolean) as string[];
      const pages = await buildBookPages({ front, cuts, back, layout: "spread" });
      const book = await saveDraft({
        pages,
        pageW: PAGE_W,
        layout: "spread",
        title: bk.meta?.title,
        storyText: scriptParsed || undefined,
      });
      router.push(`/edit?book=${book.id}`);
    } catch (e) {
      showToast("보내기 실패: " + ((e as Error)?.message || ""));
      setSendBusy(false);
    }
  }

  function loadLib(obj: StoryLib | StoryBook) {
    const norm = normalizeLib(obj);
    if (!norm) return;
    setLib(norm);
    setBookIdx(0);
    setActiveChar(0);
    setSection("chars");
    setCutFilter("all");
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(norm)); } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showToast(msg = "복사됐어요!") {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 1400);
  }

  function copyText(txt: string) {
    navigator.clipboard.writeText(txt).then(() => showToast());
  }

  function openBook(i: number) {
    setBookIdx(i);
    setActiveChar(0);
    setSection("chars");
    setCutFilter("all");
    if (window.innerWidth <= 900) setSidebarOpen(false);
  }

  function jumpToChar(id: string) {
    const idx = (book?.characters || []).findIndex((c) => c.id === id);
    if (idx < 0) return;
    setActiveChar(idx);
    setSection("chars");
    setTimeout(() => {
      document.querySelector(".story-char-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  function applyJsonText() {
    const txt = jsonText.trim();
    if (!txt) { setJsonErr("JSON 내용을 입력하세요."); return; }
    try {
      const obj = JSON.parse(txt);
      loadLib(obj);
      setJsonText("");
      setJsonErr("");
      setJsonModalOpen(false);
    } catch (err) {
      setJsonErr("JSON 파싱 실패: " + (err as Error).message);
    }
  }

  function handleModalFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const txt = String(r.result);
      setJsonText(txt);
      try {
        loadLib(JSON.parse(txt));
        setJsonText("");
        setJsonErr("");
        setJsonModalOpen(false);
      } catch (err) {
        setJsonErr("JSON 파싱 실패: " + (err as Error).message);
      }
    };
    r.readAsText(f);
    e.target.value = "";
  }

  function resetToSample() {
    if (!window.confirm("초기화하면 캐릭터 시트·본문 컷에 저장된 이미지와 본문 대본이 모두 지워집니다. 계속할까요?")) return;
    try { localStorage.removeItem(CACHE_KEY); } catch {}
    try { localStorage.removeItem(SCRIPT_KEY); } catch {}
    try { localStorage.removeItem(SCRIPT_INPUT_KEY); } catch {}
    // 표시 중인 이미지 URL 맵도 함께 비운다 — lib 만 샘플로 갈아끼우면 키가 겹치는
    // 캐릭터/컷의 이전 이미지가 그대로 남아 보인다.
    setImageUrls({});
    setCutImageUrls({});
    setCoverImageUrls({});
    // 본문 대본 상태 초기화 (저장 키는 위에서 제거)
    setScriptInput("");
    setScriptPreview("");
    setScriptParsed("");
    fetch(SAMPLE_URL).then((r) => r.json()).then((obj) => loadLib(obj));
  }

  // 모달 ESC / Cmd+Enter
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setJsonModalOpen(false); setScriptModalOpen(false); setMatchModalOpen(false); setSidebarOpen(false); }
      if (jsonModalOpen && (e.metaKey || e.ctrlKey) && e.key === "Enter") applyJsonText();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsonModalOpen, jsonText]);

  // 윈도우 리사이즈 시 모바일 사이드바 닫힘
  useEffect(() => {
    function onResize() { if (window.innerWidth > 900) setSidebarOpen(false); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const libName = lib?.library_meta?.name || "우리 그림책 서재";
  const books = lib?.books || [];
  const chars = book?.characters || [];
  const cuts = book?.cuts || [];
  const covers = book?.covers || [];
  // 웹툰 책이면 컷(=페이지)을 세로 9:16, 아니면 가로 16:9 로 생성한다.
  const cutAspect: Aspect = isWebtoonBook(book) ? "9:16" : "16:9";
  // emotion 필드가 있는 컷이 하나도 없으면 인물매칭 모달의 '감정' 컬럼을 숨긴다.
  const matchHasEmotion = cuts.some((c) => c.emotion);
  const currentChar = chars[activeChar] || null;

  return (
    <div className="story-root">
      {/* TOPBAR */}
      <header className="story-topbar">
        <button
          type="button"
          className="story-menu-toggle"
          aria-label="메뉴 열기"
          onClick={() => setSidebarOpen((v) => !v)}
        >
          <Menu size={20} />
        </button>
        <div className="story-brand">
          <Link href="/" className="story-back-btn" aria-label="홈으로">
            <ArrowLeft size={16} /> 홈
          </Link>
          <span className="story-kicker">스토리구성 · 그림책</span>
          <span className="story-lib-name">{libName}</span>
        </div>
        <div className="story-top-actions">
          <div
            className="story-img-engine story-engine-top"
            role="tablist"
            aria-label="이미지 생성 엔진"
            title="이미지 생성 엔진 — 단건/전체생성 모두 여기서 고른 엔진으로 만듭니다"
          >
            <button
              type="button"
              className={`story-eng${genEngine === "chatgpt" ? " active" : ""}`}
              onClick={() => pickEngine("chatgpt")}
            >
              ChatGPT
            </button>
            <button
              type="button"
              className={`story-eng${genEngine === "flow" ? " active" : ""}`}
              onClick={() => pickEngine("flow")}
            >
              Flow
            </button>
          </div>
          <button type="button" className="story-btn story-btn--ghost" onClick={resetToSample} title="책장을 초기 상태로 되돌리기">
            초기화
          </button>
          <button
            type="button"
            className="story-btn"
            onClick={() => setScriptModalOpen(true)}
            title="본문 대본을 붙여넣어 넘버링을 제거하고 빈 줄 두 번으로 파싱"
          >
            본문대본
          </button>
          <button type="button" className="story-btn" onClick={() => setJsonModalOpen(true)}>
            JSON 불러오기
          </button>
          <button
            type="button"
            className="story-btn story-btn--apply"
            onClick={sendToEditor}
            disabled={sendBusy || !book}
            title="생성된 이미지로 책만들기 페이지를 자동 구성 (앞표지·본문·뒷표지)"
          >
            <BookOpen size={16} /> {sendBusy ? "보내는 중…" : "책만들기로 보내기"}
          </button>
        </div>
      </header>

      {extUpdate && (
        <div className="story-ext-update" role="alert">
          <span>
            이미지 생성 확장 업데이트가 있어요 — 설치됨 v{extUpdate.installed} → 최신 v{extUpdate.latest}.
            새 폴더를 받아 <code>chrome://extensions</code>에서 다시 로드하세요.
          </span>
          <span className="story-ext-update-actions">
            {extUpdate.downloadUrl && (
              <a className="story-mini" href={extUpdate.downloadUrl} target="_blank" rel="noreferrer">
                새 버전 받기
              </a>
            )}
            <button type="button" className="story-mini story-mini--ghost" onClick={() => setExtUpdate(null)}>
              닫기
            </button>
          </span>
        </div>
      )}

      {sidebarOpen && (
        <div className="story-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="story-layout">
        {/* SIDEBAR */}
        <aside className={`story-sidebar${sidebarOpen ? " open" : ""}`}>
          <div className="story-side-section">
            <div className="story-side-title">
              <Library size={18} /> 책장 <span className="story-badge">{books.length}권</span>
            </div>
            <div className="story-shelf">
              {books.length === 0 && (
                <div className="story-side-empty">JSON을 불러오세요</div>
              )}
              {books.map((bk, i) => {
                const col = /calm|night|밤/.test(bk?.meta?.mood || "") ? "#7b74d9" : "#f06f5f";
                const cutCount = (bk?.cuts || []).length;
                const charCount = (bk?.characters || []).length;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`story-book-tab${i === bookIdx ? " active" : ""}`}
                    onClick={() => openBook(i)}
                  >
                    <span className="story-bt-spine" style={{ background: col }} />
                    <div className="story-bt-title">{bk?.meta?.title}</div>
                    <div className="story-bt-sub">{bk?.meta?.source || ""} · {cutCount}컷 · 캐릭터 {charCount}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="story-side-section">
            <div className="story-nav-list">
              <button
                type="button"
                className={`story-nav-item${section === "chars" ? " active" : ""}`}
                onClick={() => { setSection("chars"); if (window.innerWidth <= 900) setSidebarOpen(false); }}
              >
                <span className="story-nav-ic"><UsersRound size={18} /></span>
                <span className="story-nav-lbl">캐릭터 시트</span>
                <span className="story-badge">{chars.length}</span>
              </button>
              <button
                type="button"
                className={`story-nav-item${section === "cuts" ? " active" : ""}`}
                onClick={() => { setSection("cuts"); if (window.innerWidth <= 900) setSidebarOpen(false); }}
              >
                <span className="story-nav-ic"><Clapperboard size={18} /></span>
                <span className="story-nav-lbl">본문 컷</span>
                <span className="story-badge">{cuts.length}{covers.length ? `+${covers.length}` : ""}</span>
              </button>
            </div>
            {!book && <div className="story-side-empty">책을 선택하세요</div>}
          </div>

          <div className="story-side-section">
            <div className="story-nav-list">
              <a
                className="story-nav-item story-guide story-guide--gpt"
                href="https://chatgpt.com/g/g-6a213b075c3c8191bf103f609057af25-pro-4dangye-aiwa-hamggehaneun-geurimcaeg-mandeulgi-v6-5-fn"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="story-nav-ic"><BookOpen size={18} /></span>
                <span className="story-nav-lbl">그림책 지침 GPT</span>
                <ExternalLink size={14} className="story-ext-ic" />
              </a>
              <a
                className="story-nav-item story-guide story-guide--chat"
                href="https://chatgpt.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="story-nav-ic"><MessageSquare size={18} /></span>
                <span className="story-nav-lbl">챗지피티 바로가기</span>
                <ExternalLink size={14} className="story-ext-ic" />
              </a>
              <a
                className="story-nav-item story-guide story-guide--flow"
                href="https://labs.google/fx/ko/tools/flow/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="story-nav-ic"><Workflow size={18} /></span>
                <span className="story-nav-lbl">FLOW 바로가기</span>
                <ExternalLink size={14} className="story-ext-ic" />
              </a>
              <a
                className="story-nav-item story-guide story-guide--voice"
                href="https://elevenlabs.io/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="story-nav-ic"><AudioLines size={18} /></span>
                <span className="story-nav-lbl">일레븐랩스 바로가기</span>
                <ExternalLink size={14} className="story-ext-ic" />
              </a>
              <a
                className="story-nav-item story-guide story-guide--music"
                href="https://gemini.google.com/gem/6bbd0e1665fb/7ebb7f6cc46ea2b4?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="story-nav-ic"><Wand2 size={18} /></span>
                <span className="story-nav-lbl">음악만들기</span>
                <ExternalLink size={14} className="story-ext-ic" />
              </a>
              <a
                className="story-nav-item story-guide story-guide--suno"
                href="https://suno.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="story-nav-ic"><Music size={18} /></span>
                <span className="story-nav-lbl">SUNO 바로가기</span>
                <ExternalLink size={14} className="story-ext-ic" />
              </a>
              <a
                className="story-nav-item story-guide story-guide--book"
                href="https://tbbook.aitoolb.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="story-nav-ic"><BookOpen size={18} /></span>
                <span className="story-nav-lbl">매직북 바로가기</span>
                <ExternalLink size={14} className="story-ext-ic" />
              </a>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="story-content">
          {!book && (
            <div className="story-lib-empty">
              <div className="story-lib-empty-ic"><BookOpen size={40} /></div>
              <div className="story-lib-empty-title">아직 책장이 비어 있어요</div>
              <div className="story-lib-empty-desc">그림책 JSON 데이터를 불러와 캐릭터·컷·표지를 한눈에 펼쳐보세요.</div>
              <button type="button" className="story-lib-empty-btn" onClick={() => setJsonModalOpen(true)}>
                <FileInput size={18} /> JSON 불러오기
              </button>
            </div>
          )}

          {book && (
            <div className="story-book-view">
              <div className="story-book-head">
                <h1>{book.meta?.title}</h1>
                <div className="story-meta-row">
                  {([
                    ["원작", book.meta?.source],
                    ["연령", book.meta?.age ? (/[세~]/.test(String(book.meta.age)) ? String(book.meta.age) : `${book.meta.age}세`) : null],
                    ["분위기", book.meta?.mood ?? book.meta?.theme],
                    ["컷 수", `${cuts.length}컷`],
                  ] as [string, string | null | undefined][]).filter(([, v]) => v).map(([k, v]) => (
                    <span key={k} className="story-chip">{k} · {v}</span>
                  ))}
                </div>
                {book.meta?.message && (
                  <p className="story-message">{book.meta.message}</p>
                )}
              </div>

              {section === "chars" && (
                <section className="story-sec-pane">
                  <div className="story-sec-title">
                    캐릭터 시트
                    <div className="story-sec-actions">
                      {bulkBusy ? (
                        <button type="button" className="story-mini story-mini--ghost" onClick={cancelBulk}>
                          <Square size={13} /> 전체 정지
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="story-mini"
                          disabled={!extReady || chars.length === 0}
                          title={extReady ? "이미지가 없는 캐릭터를 순서대로 모두 생성" : "이미지 생성 확장 설치 후 사용 가능"}
                          onClick={generateAll}
                        >
                          <Sparkles size={14} /> 전체생성
                        </button>
                      )}
                      <button
                        type="button"
                        className="story-mini story-mini--ghost"
                        title="생성된 캐릭터 이미지를 ZIP으로 모두 받기"
                        onClick={downloadAllZip}
                        disabled={zipBusy}
                      >
                        <Download size={14} /> {zipBusy ? "ZIP 준비 중…" : "전체 다운로드"}
                      </button>
                      <button
                        type="button"
                        className="story-mini story-mini--ghost"
                        title="모든 캐릭터의 프롬프트(본문+add+네거티브)를 빈 줄로 구분해 한 번에 복사"
                        onClick={() => copyText(chars.map((c) => buildPrompt(book, c.prompt_en || "", "char")).join("\n\n"))}
                      >
                        전체 프롬프트 복사
                      </button>
                    </div>
                  </div>
                  {bulkStatus && <div className="story-bulk-status">{bulkStatus}</div>}
                  <div className="story-sec-sub">{chars.length}종 · 탭으로 캐릭터를 선택하세요</div>
                  <div className="story-char-tabs">
                    {chars.map((c, i) => (
                      <button
                        key={c.id || i}
                        type="button"
                        className={`story-ctab${i === activeChar ? " active" : ""}`}
                        onClick={() => setActiveChar(i)}
                      >
                        <span className="story-dot" style={{ background: dotColor(c) }} />
                        {c.name_ko || c.id}
                      </button>
                    ))}
                  </div>
                  {currentChar && (
                    <CharPanel
                      key={charKeyOf(bookIdx, currentChar, activeChar)}
                      char={currentChar}
                      imageUrl={imageUrls[charKeyOf(bookIdx, currentChar, activeChar)]}
                      imageKey={typeof currentChar.imageKey === "string" ? currentChar.imageKey : undefined}
                      busy={bulkBusy}
                      onGenerated={(dataUrl) => handleCharImage(activeChar, dataUrl)}
                      appearCuts={cuts.filter((cut) => (cut.ref || []).includes(currentChar.id || "")).map((cut) => cut.no)}
                      onCopy={(t) => copyText(t)}
                      buildPromptFor={(base) => buildPrompt(book, base, "char")}
                    />
                  )}
                </section>
              )}

              {section === "cuts" && (
                <section className="story-sec-pane">
                  <div className="story-sec-title">
                    본문 컷
                    <div className="story-sec-actions">
                      {cutBulkBusy ? (
                        <button type="button" className="story-mini story-mini--ghost" onClick={cancelCutBulk}>
                          <Square size={13} /> 전체 정지
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="story-mini"
                          disabled={!extReady || cuts.length === 0}
                          title={extReady ? "이미지가 없는 컷을 등장 캐릭터 참조(I2I)로 순서대로 생성" : "이미지 생성 확장 설치 후 사용 가능"}
                          onClick={generateAllCuts}
                        >
                          <Sparkles size={14} /> 전체생성
                        </button>
                      )}
                      <button
                        type="button"
                        className="story-mini story-mini--ghost"
                        title="생성된 컷 이미지를 ZIP으로 모두 받기"
                        onClick={downloadAllCutsZip}
                        disabled={cutZipBusy}
                      >
                        <Download size={14} /> {cutZipBusy ? "ZIP 준비 중…" : "전체 다운로드"}
                      </button>
                      <button
                        type="button"
                        className="story-mini story-mini--ghost story-match-btn"
                        title={scriptParsed ? "파싱된 본문 대본 복사" : "먼저 우측 상단 본문대본 버튼으로 대본을 등록하세요"}
                        onClick={() => {
                          if (scriptParsed) copyText(scriptParsed);
                          else setScriptModalOpen(true);
                        }}
                      >
                        <ScrollText size={14} /> 대본추출
                      </button>
                      <button
                        type="button"
                        className="story-mini story-mini--ghost story-match-btn"
                        title="컷별 등장 인물(이름·역할)을 한눈에 보기"
                        onClick={() => setMatchModalOpen(true)}
                      >
                        <UsersRound size={14} /> 인물매칭
                      </button>
                      <button
                        type="button"
                        className="story-mini story-mini--ghost"
                        title="모든 컷·표지 프롬프트(본문+add+네거티브)를 빈 줄로 구분해 한 번에 복사"
                        onClick={() => copyText([
                          ...cuts.map((c) => buildPrompt(book, c.prompt_en || "", "scene")),
                          ...covers.map((c) => buildPrompt(book, c.prompt_en || "", "cover")),
                        ].join("\n\n"))}
                      >
                        전체 프롬프트 복사
                      </button>
                    </div>
                  </div>
                  {cutBulkStatus && <div className="story-bulk-status">{cutBulkStatus}</div>}
                  <div className="story-sec-sub">{cuts.length}컷{covers.length ? ` · 표지 ${covers.length}` : ""} · 번호/표지 탭을 누르면 해당 항목만 보기 · ref 태그를 누르면 해당 캐릭터로 이동</div>
                  <div className="story-filterbar">
                    <button
                      type="button"
                      className={`story-fb${cutFilter === "all" ? " active" : ""}`}
                      onClick={() => setCutFilter("all")}
                    >전체</button>
                    {cuts.map((c) => (
                      <button
                        key={String(c.no)}
                        type="button"
                        className={`story-fb${cutFilter === c.no ? " active" : ""}`}
                        onClick={() => setCutFilter(c.no ?? "all")}
                      >{c.no}</button>
                    ))}
                    {covers.map((co, i) => {
                      const key = `cover-${co.type || i}`;
                      const lbl = co.type === "front" ? "앞표지" : co.type === "back" ? "뒤표지" : `표지${i + 1}`;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`story-fb story-fb--cover${cutFilter === key ? " active" : ""}`}
                          onClick={() => setCutFilter(key)}
                        >{lbl}</button>
                      );
                    })}
                  </div>
                  <div className="story-cut-list">
                    {cuts
                      .map((cut, i) => ({ cut, i }))
                      .filter(({ cut }) => cutFilter === "all" || cut.no === cutFilter)
                      .map(({ cut, i }) => (
                        <CutCard
                          key={cutKeyOf(bookIdx, cut, i)}
                          cut={cut}
                          charMap={charMap}
                          imageUrl={cutImageUrls[cutKeyOf(bookIdx, cut, i)]}
                          imageKey={typeof cut.imageKey === "string" ? cut.imageKey : undefined}
                          busy={cutBulkBusy}
                          extReady={extReady}
                          resolveRefs={resolveCutRefs}
                          onGenerated={(dataUrl) => handleCutImage(i, dataUrl)}
                          onCopy={(t) => copyText(t)}
                          onJumpChar={jumpToChar}
                          buildPromptFor={(base) => buildPrompt(book, base, "scene")}
                          onEditPanels={(panels) => handleCutPanels(i, panels)}
                          aspect={cutAspect}
                        />
                      ))}
                    {covers
                      .map((co, i) => ({ co, i, key: `cover-${co.type || i}` }))
                      .filter(({ key }) => cutFilter === "all" || cutFilter === key)
                      .map(({ co, i, key }) => (
                        <CoverCard
                          key={key}
                          cover={co}
                          charMap={charMap}
                          imageUrl={coverImageUrls[coverKeyOf(bookIdx, co, i)]}
                          imageKey={typeof co.imageKey === "string" ? co.imageKey : undefined}
                          busy={cutBulkBusy}
                          extReady={extReady}
                          resolveRefs={resolveCutRefs}
                          onGenerated={(dataUrl) => handleCoverImage(i, dataUrl)}
                          onCopy={(t) => copyText(t)}
                          onJumpChar={jumpToChar}
                          buildPromptFor={(base) => buildPrompt(book, base, "cover")}
                          genPrompt={buildCoverPrompt(book, co, scriptParsed)}
                        />
                      ))}
                  </div>
                </section>
              )}

              <footer className="story-footer">이야기 → 캐릭터 → 컷 → 표지 · 한 흐름으로 만든 그림책</footer>
            </div>
          )}
        </main>
      </div>

      {/* TOAST */}
      <div className={`story-toast${toastMsg ? " show" : ""}`}>{toastMsg || "복사됐어요!"}</div>

      {/* JSON MODAL */}
      {jsonModalOpen && (
        <div
          className="story-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if ((e.target as HTMLElement).classList.contains("story-modal-backdrop")) setJsonModalOpen(false); }}
        >
          <div className="story-modal">
            <div className="story-modal-head">
              <h2><FileInput size={18} /> JSON 불러오기</h2>
              <button type="button" className="story-modal-close" aria-label="닫기" onClick={() => setJsonModalOpen(false)}>
                <X size={22} />
              </button>
            </div>
            <div className="story-modal-body">
              <div className="story-hint">
                아래에 JSON 내용을 붙여넣고 <b>적용</b>을 누르세요. 또는 좌측 하단 <b>파일 선택</b>으로 .json 파일을 불러올 수 있어요.
              </div>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='{"library_meta": {...}, "books": [...]}'
                autoFocus
              />
              <div className="story-modal-err">{jsonErr}</div>
            </div>
            <div className="story-modal-foot">
              <button type="button" className="story-btn story-filepick" onClick={() => modalFileRef.current?.click()}>
                <FolderOpen size={16} /> 파일 선택
              </button>
              <input
                ref={modalFileRef}
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={handleModalFile}
              />
              <button type="button" className="story-btn" onClick={() => setJsonModalOpen(false)}>취소</button>
              <button type="button" className="story-btn story-btn--apply" onClick={applyJsonText}>적용</button>
            </div>
          </div>
        </div>
      )}

      {/* SCRIPT MODAL */}
      {scriptModalOpen && (
        <div
          className="story-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if ((e.target as HTMLElement).classList.contains("story-modal-backdrop")) setScriptModalOpen(false); }}
        >
          <div className="story-modal story-script-modal">
            <div className="story-modal-head">
              <h2><ScrollText size={18} /> 본문 대본</h2>
              <button type="button" className="story-modal-close" aria-label="닫기" onClick={() => setScriptModalOpen(false)}>
                <X size={22} />
              </button>
            </div>
            <div className="story-modal-body">
              <div className="story-hint">
                넘버링(1, 2, 3 …)이 있는 본문 대본을 붙여넣으세요. 숫자 줄은 자동으로 빠지고 각 문단은 빈 줄 두 개로 구분됩니다. 오른쪽 결과는 직접 수정할 수도 있어요.
              </div>
              <div className="story-script-grid">
                <div className="story-script-col">
                  <div className="story-script-col-title">붙여넣기</div>
                  <textarea
                    value={scriptInput}
                    onChange={(e) => {
                      const v = e.target.value;
                      setScriptInput(v);
                      setScriptPreview(parseScript(v));
                    }}
                    placeholder={"1\n\n저녁이 되면 ...\n\n2\n\n오늘 반찬은 ..."}
                    autoFocus
                  />
                </div>
                <div className="story-script-col">
                  <div className="story-script-col-title">
                    파싱 결과
                    <span className="story-muted">({scriptPreview ? scriptPreview.split(/\n\n+/).filter(Boolean).length : 0}문단 · 직접 수정 가능)</span>
                    <button
                      type="button"
                      className="story-script-reparse"
                      title="왼쪽 입력에서 다시 파싱"
                      onClick={() => setScriptPreview(parseScript(scriptInput))}
                    >다시 파싱</button>
                  </div>
                  <textarea
                    value={scriptPreview}
                    onChange={(e) => setScriptPreview(e.target.value)}
                    placeholder="여기에 결과가 표시돼요 (직접 입력·수정 가능)"
                  />
                </div>
              </div>
            </div>
            <div className="story-modal-foot">
              <button
                type="button"
                className="story-btn"
                onClick={() => {
                  setScriptInput(""); setScriptPreview(""); setScriptParsed("");
                  try { localStorage.removeItem(SCRIPT_KEY); } catch {}
                }}
                title="입력·결과·저장된 대본을 모두 지움"
              >
                비우기
              </button>
              <button type="button" className="story-btn" onClick={() => setScriptModalOpen(false)}>닫기</button>
              <button
                type="button"
                className="story-btn"
                disabled={!scriptPreview}
                onClick={() => { if (scriptPreview) copyText(scriptPreview); }}
              >
                복사
              </button>
              <button
                type="button"
                className="story-btn story-btn--apply"
                disabled={!scriptPreview}
                onClick={() => {
                  setScriptParsed(scriptPreview);
                  try {
                    localStorage.setItem(SCRIPT_KEY, scriptPreview);
                    // 원본(넘버링 포함)도 저장해 왼쪽 붙여넣기 칸에 그대로 남도록.
                    localStorage.setItem(SCRIPT_INPUT_KEY, scriptInput);
                  } catch {}
                  showToast("대본을 저장했어요!");
                  setScriptModalOpen(false);
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHARACTER-MATCH MODAL */}
      {matchModalOpen && (
        <div
          className="story-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if ((e.target as HTMLElement).classList.contains("story-modal-backdrop")) setMatchModalOpen(false); }}
        >
          <div className="story-modal story-match-modal">
            <div className="story-modal-head">
              <h2><UsersRound size={18} /> 컷별 인물 매칭</h2>
              <button type="button" className="story-modal-close" aria-label="닫기" onClick={() => setMatchModalOpen(false)}>
                <X size={22} />
              </button>
            </div>
            <div className="story-modal-body">
              <div className="story-hint">
                각 컷·표지에 등장하는 캐릭터를 한 번에 확인할 수 있어요.
              </div>
              {cuts.length === 0 && covers.length === 0 ? (
                <div className="story-match-empty">등록된 컷·표지가 없어요.</div>
              ) : (
                <div className={`story-match-table${matchHasEmotion ? "" : " no-emo"}`}>
                  <div className="story-match-row story-match-head-row">
                    <div className="story-match-col-no">#</div>
                    {matchHasEmotion && <div className="story-match-col-emo">감정</div>}
                    <div className="story-match-col-chars">등장 인물</div>
                  </div>
                  {cuts.map((cut) => {
                    const refs = (cut.ref || [])
                      .map((id) => charMap[id])
                      .filter(Boolean);
                    return (
                      <div key={`cut-${cut.no}`} className="story-match-row">
                        <div className="story-match-col-no">
                          <span className="story-match-no-badge">{cut.no}</span>
                        </div>
                        {matchHasEmotion && <div className="story-match-col-emo">{cut.emotion || "—"}</div>}
                        <div className="story-match-col-chars">
                          {refs.length === 0 ? (
                            <span className="story-match-none">—</span>
                          ) : (
                            refs.map((c) => (
                              <span key={c.id} className="story-match-chip">
                                <span className="story-dot" style={{ background: dotColor(c) }} />
                                <b>{c.name_ko || c.id}</b>
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {covers.map((co, i) => {
                    const refs = (co.ref || [])
                      .map((id) => charMap[id])
                      .filter(Boolean);
                    const lbl = co.type === "front" ? "앞표지" : co.type === "back" ? "뒤표지" : `표지${i + 1}`;
                    return (
                      <div key={`cover-${co.type || i}`} className="story-match-row story-match-row-cover">
                        <div className="story-match-col-no">
                          <span className="story-match-no-badge story-match-cover-badge">{lbl}</span>
                        </div>
                        {matchHasEmotion && <div className="story-match-col-emo">표지</div>}
                        <div className="story-match-col-chars">
                          {refs.length === 0 ? (
                            <span className="story-match-none">—</span>
                          ) : (
                            refs.map((c) => (
                              <span key={c.id} className="story-match-chip">
                                <span className="story-dot" style={{ background: dotColor(c) }} />
                                <b>{c.name_ko || c.id}</b>
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="story-modal-foot">
              <button type="button" className="story-btn" onClick={() => setMatchModalOpen(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// API/ChatGPT 엔진 토글 — 지금은 ChatGPT(확장)만 사용하므로 숨김.
// 나중에 Path A(API)를 다시 쓰려면 true 로 바꾸면 토글이 다시 나타난다.
const SHOW_ENGINE_TOGGLE = false;

function CharPanel({ char, imageUrl, imageKey, busy, onGenerated, appearCuts, onCopy, buildPromptFor }: {
  char: StoryChar;
  imageUrl?: string;
  imageKey?: string;
  busy?: boolean;
  onGenerated: (dataUrl: string) => void;
  appearCuts: (number | string | undefined)[];
  onCopy: (t: string) => void;
  buildPromptFor: (base: string) => string;
}) {
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [engine, setEngine] = useState<Engine>("chatgpt");
  const [extReady, setExtReady] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const handleRef = useRef<GenHandle | null>(null);

  const ASPECT: Aspect = "16:9";
  const fileName = (char.name_ko || char.id || "character").toString();
  // Download href: presigned R2 attachment when saved; data URL falls back to direct download.
  const downloadHref = imageKey
    ? `/api/story/download?key=${encodeURIComponent(imageKey)}&name=${encodeURIComponent(fileName)}`
    : imageUrl;

  // Detect the ChatGPT helper extension so its engine option can be enabled.
  useEffect(() => {
    let alive = true;
    isExtensionReady().then((r) => { if (alive) setExtReady(r); });
    return () => { alive = false; };
  }, []);

  // Esc closes the image lightbox.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onGenerated(String(reader.result)); // → R2 + persist on this character
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  function startGenerate() {
    if (generating) return;
    const prompt = buildPromptFor(char.prompt_en || "");
    if (!prompt.trim()) { setStatusMsg("프롬프트가 비어 있어요."); return; }
    setGenerating(true);
    setStatusMsg(engine === "chatgpt" ? "생성 준비 중…" : "이미지 생성 중…");
    const handle = engine === "chatgpt"
      ? generateViaChatGpt({ prompt, aspect: ASPECT, onProgress: setStatusMsg })
      : generateViaApi({ prompt, aspect: ASPECT });
    handleRef.current = handle;
    handle.promise
      .then((dataUrl) => { onGenerated(dataUrl); setStatusMsg(""); })
      .catch((err: unknown) => { setStatusMsg((err as Error)?.message || "생성 실패"); })
      .finally(() => { setGenerating(false); handleRef.current = null; });
  }

  function stopGenerate() {
    handleRef.current?.cancel();
    handleRef.current = null;
    setGenerating(false);
    setStatusMsg("정지됨");
  }

  return (
    <div className="story-char-panel" key={char.id}>
      <div className="story-cp-head">
        <button
          type="button"
          className="story-cp-name"
          title="클릭해서 이름 복사"
          onClick={() => onCopy(char.name_ko || char.id || "")}
        >
          <span className="story-dot" style={{ background: dotColor(char) }} />
          {char.name_ko || char.id}
        </button>
        {char.role && <span className="story-cp-role">{char.role}</span>}
      </div>
      <div className="story-cp-id">
        {char.id_point || ""}{" "}
        <button
          type="button"
          className="story-cp-idcode"
          title="클릭해서 id 복사"
          onClick={() => onCopy(escapeId(char.id))}
        >
          {escapeId(char.id)}
        </button>
      </div>

      <div className="story-cp-row">
        {/* LEFT 60% — prompt */}
        <div className="story-cp-left">
          <div className="story-prompt">{buildPromptFor(char.prompt_en || "")}</div>
          <div className="story-actions">
            <button
              type="button"
              className="story-mini"
              title="본문 + character_add + 네거티브를 합쳐 복사"
              onClick={() => onCopy(buildPromptFor(char.prompt_en || ""))}
            >
              프롬프트 복사
            </button>
          </div>
        </div>

        {/* RIGHT 40% — image */}
        <div className="story-cp-imgcol">
          <div className="story-img-stage">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="캐릭터 이미지"
                className="story-img-preview"
                role="button"
                title="클릭해서 크게 보기"
                onClick={() => setLightbox(true)}
              />
            ) : (
              <div className="story-img-empty">
                <ImagePlus size={28} />
                <span>이미지를 업로드하거나<br />생성해 주세요</span>
              </div>
            )}
            {generating && (
              <div className="story-img-progress">{statusMsg || "생성 중…"}</div>
            )}
            <button
              type="button"
              className="story-img-upload"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus size={14} /> 이미지 업로드
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onPickFile}
            />
          </div>

          {SHOW_ENGINE_TOGGLE && (
            <div className="story-img-engine" role="tablist" aria-label="이미지 생성 엔진">
              <button
                type="button"
                className={`story-eng${engine === "api" ? " active" : ""}`}
                onClick={() => setEngine("api")}
              >
                API
              </button>
              <button
                type="button"
                className={`story-eng${engine === "chatgpt" ? " active" : ""}`}
                onClick={() => setEngine("chatgpt")}
                title={extReady ? "ChatGPT 확장으로 생성" : "확장 미설치 — 설치 후 사용 가능"}
              >
                ChatGPT{extReady ? "" : " (미설치)"}
              </button>
            </div>
          )}

          <div className="story-img-actions">
            <button
              type="button"
              className="story-mini"
              onClick={startGenerate}
              disabled={generating || busy || (engine === "chatgpt" && !extReady)}
            >
              <Sparkles size={14} /> {generating ? "생성 중…" : "이미지 생성"}
            </button>
            <button
              type="button"
              className="story-mini story-mini--ghost"
              onClick={stopGenerate}
              disabled={!generating}
            >
              <Square size={13} /> 정지
            </button>
          </div>
          {statusMsg && !generating && (
            <div className="story-img-msg">{statusMsg}</div>
          )}
        </div>
      </div>

      <div className="story-cp-appear">등장 컷: <b>{appearCuts.length ? appearCuts.join(", ") : "없음"}</b></div>

      {lightbox && imageUrl && (
        <div
          className="story-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if ((e.target as HTMLElement).classList.contains("story-modal-backdrop")) setLightbox(false); }}
        >
          <div className="story-lightbox">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={fileName} className="story-lightbox__img" />
            <div className="story-lightbox__bar">
              {downloadHref && (
                <a className="story-btn story-btn--apply" href={downloadHref} download={`${fileName}.png`}>
                  <Download size={16} /> 다운로드
                </a>
              )}
              <button type="button" className="story-btn" onClick={() => setLightbox(false)}>
                <X size={16} /> 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RefTags({ refs, charMap, onJumpChar }: {
  refs?: string[];
  charMap: Record<string, StoryChar>;
  onJumpChar: (id: string) => void;
}) {
  return (
    <>
      {(refs || []).map((id) => {
        const ch = charMap[id];
        const nm = ch ? ch.name_ko : id;
        const col = ch ? dotColor(ch) : "#c9a14a";
        return (
          <span
            key={id}
            className="story-reftag"
            onClick={() => onJumpChar(id)}
          >
            <span className="story-dot" style={{ background: col }} />
            {nm}
          </span>
        );
      })}
    </>
  );
}

function CutCard({ cut, charMap, imageUrl, imageKey, busy, extReady, resolveRefs, onGenerated, onCopy, onJumpChar, buildPromptFor, onEditPanels, aspect }: {
  cut: StoryCut;
  charMap: Record<string, StoryChar>;
  imageUrl?: string;
  imageKey?: string;
  busy?: boolean;
  extReady?: boolean;
  resolveRefs: (cut: StoryCut) => Promise<{ images: string[]; names: string[]; missing: number }>;
  onGenerated: (dataUrl: string) => void;
  onCopy: (t: string) => void;
  onJumpChar: (id: string) => void;
  buildPromptFor: (base: string) => string;
  onEditPanels: (panels: WebtoonPanel[]) => void;
  aspect: Aspect;
}) {
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [lightbox, setLightbox] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const handleRef = useRef<GenHandle | null>(null);

  // 말풍선 글자가 박힌 최종 프롬프트(자리표시자 치환 → 스타일/네거티브 병합).
  // 말풍선 text 가 곧 이미지 글자라, 아래 편집기에서 고치면 여기에 즉시 반영된다.
  const finalPrompt = buildPromptFor(substituteBubbles(cut.prompt_en || "", cut));
  const panels = cutPanels(cut);
  const hasText = cutHasText(cut);

  // 한 패널의 narration/bubbles 중 한 항목의 text 만 바꿔 새 panels 를 만들어 올린다.
  function editItemText(
    kind: "narration" | "bubbles",
    pi: number,
    idx: number,
    text: string,
  ) {
    const next = panels.map((p, i) => {
      if (i !== pi) return p;
      const arr = (p[kind] || []).map((it, j) =>
        j === idx ? { ...it, text } : it,
      );
      return { ...p, [kind]: arr };
    });
    onEditPanels(next);
  }

  const fileName = `cut_${cut.no ?? ""}`;
  const downloadHref = imageKey
    ? `/api/story/download?key=${encodeURIComponent(imageKey)}&name=${encodeURIComponent(fileName)}`
    : imageUrl;

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onGenerated(String(reader.result));
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  // Image-to-image: upload the cut's reference character images + prompt at the
  // book's aspect (웹툰=9:16, 그림책=16:9).
  function startGenerate() {
    if (generating) return;
    const prompt = finalPrompt;
    if (!prompt.trim()) { setStatusMsg("프롬프트가 비어 있어요."); return; }
    setGenerating(true);
    setStatusMsg("참조 이미지 준비 중…");
    let cancelled = false;
    const composite: GenHandle = {
      promise: (async () => {
        const refs = await resolveRefs(cut);
        if (cancelled) throw new Error("정지됨 (사용자 취소)");
        if (refs.missing) setStatusMsg(`참조 ${refs.images.length}장 사용 (없음 ${refs.missing}) · 생성 중…`);
        const inner = generateViaChatGpt({
          prompt,
          aspect,
          referenceImages: refs.images,
          referenceNames: refs.names,
          onProgress: setStatusMsg,
        });
        handleRef.current = inner;
        return await inner.promise;
      })(),
      cancel: () => { cancelled = true; handleRef.current?.cancel(); },
    };
    handleRef.current = composite;
    composite.promise
      .then((dataUrl) => { onGenerated(dataUrl); setStatusMsg(""); })
      .catch((err: unknown) => { setStatusMsg((err as Error)?.message || "생성 실패"); })
      .finally(() => { setGenerating(false); handleRef.current = null; });
  }

  function stopGenerate() {
    handleRef.current?.cancel();
    handleRef.current = null;
    setGenerating(false);
    setStatusMsg("정지됨");
  }

  return (
    <div className="story-cut">
      <div className="story-cut-top">
        <div className="story-cut-no">{cut.no}</div>
        <div className="story-cut-emotion">{cut.emotion || ""}</div>
        <div className="story-cut-refs">
          <RefTags refs={cut.ref} charMap={charMap} onJumpChar={onJumpChar} />
        </div>
      </div>
      <div className="story-cut-body">
        <div className="story-cp-row">
          {/* LEFT 60% — prompt */}
          <div className="story-cp-left">
            <div className="story-prompt">{finalPrompt}</div>
            <div className="story-actions">
              <button
                type="button"
                className="story-mini"
                title="말풍선 글자 + 스타일 + 네거티브를 합쳐 복사"
                onClick={() => onCopy(finalPrompt)}
              >
                프롬프트 복사
              </button>
              {hasText && (
                <button
                  type="button"
                  className="story-mini story-mini--ghost"
                  onClick={() => setEditOpen((v) => !v)}
                  title="말풍선 대사 / 내레이션 자막을 수정"
                >
                  <MessageSquare size={13} /> {editOpen ? "편집 닫기" : "대사·내레이션 편집"}
                </button>
              )}
            </div>
            {editOpen && hasText && (
              <div className="story-textedit">
                {panels.map((p, pi) => {
                  // [BUBBLE_n] 번호는 페이지 전체 누적 → 이 패널의 시작 번호 계산.
                  const startNo = panels
                    .slice(0, pi)
                    .reduce((n, q) => n + (q.bubbles?.length || 0), 0);
                  const hasAny = (p.narration?.length || 0) + (p.bubbles?.length || 0) > 0;
                  if (!hasAny) return null;
                  return (
                    <div key={pi} className="story-textedit__panel">
                      <div className="story-textedit__pos">{p.position || `패널 ${pi + 1}`}</div>
                      {(p.narration || []).map((n, ni) => (
                        <label key={n.id || `n${ni}`} className="story-textedit__row">
                          <span className="story-textedit__tag story-textedit__tag--narr">내레이션</span>
                          <input
                            className="story-textedit__input"
                            value={n.text || ""}
                            placeholder="내레이션 자막 (이미지엔 안 그려지고 자막으로 얹힘)"
                            onChange={(e) => editItemText("narration", pi, ni, e.target.value)}
                          />
                        </label>
                      ))}
                      {(p.bubbles || []).map((b, bi) => {
                        const sp = b.speaker ? charMap[b.speaker] : undefined;
                        const spName = sp?.name_ko || b.speaker || "";
                        return (
                          <label key={b.id || `b${bi}`} className="story-textedit__row">
                            <span className="story-textedit__tag">
                              말풍선 {startNo + bi + 1}
                              {b.type === "thought" ? " · 속마음" : " · 대사"}
                              {spName ? ` · ${spName}` : ""}
                            </span>
                            <input
                              className="story-textedit__input"
                              value={b.text || ""}
                              placeholder="말풍선 안에 들어갈 한글 대사"
                              onChange={(e) => editItemText("bubbles", pi, bi, e.target.value)}
                            />
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT 40% — image (image-to-image) */}
          <div className="story-cp-imgcol">
            <div className="story-img-stage">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={`컷 ${cut.no ?? ""}`}
                  className="story-img-preview"
                  role="button"
                  title="클릭해서 크게 보기"
                  onClick={() => setLightbox(true)}
                />
              ) : (
                <div className="story-img-empty">
                  <ImagePlus size={28} />
                  <span>참조+프롬프트로<br />컷 이미지를 생성</span>
                </div>
              )}
              {generating && (
                <div className="story-img-progress">{statusMsg || "생성 중…"}</div>
              )}
              <button type="button" className="story-img-upload" onClick={() => fileRef.current?.click()}>
                <ImagePlus size={14} /> 이미지 업로드
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
            </div>
            <div className="story-img-actions">
              <button
                type="button"
                className="story-mini"
                onClick={startGenerate}
                disabled={generating || busy || !extReady}
                title={extReady ? `등장 캐릭터 이미지를 참조해 ${aspect}로 생성` : "이미지 생성 확장 설치 후 사용 가능"}
              >
                <Sparkles size={14} /> {generating ? "생성 중…" : "이미지 생성"}
              </button>
              <button
                type="button"
                className="story-mini story-mini--ghost"
                onClick={stopGenerate}
                disabled={!generating}
              >
                <Square size={13} /> 정지
              </button>
            </div>
            {statusMsg && !generating && <div className="story-img-msg">{statusMsg}</div>}
          </div>
        </div>
      </div>

      {lightbox && imageUrl && (
        <div
          className="story-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if ((e.target as HTMLElement).classList.contains("story-modal-backdrop")) setLightbox(false); }}
        >
          <div className="story-lightbox">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={fileName} className="story-lightbox__img" />
            <div className="story-lightbox__bar">
              {downloadHref && (
                <a className="story-btn story-btn--apply" href={downloadHref} download={`${fileName}.png`}>
                  <Download size={16} /> 다운로드
                </a>
              )}
              <button type="button" className="story-btn" onClick={() => setLightbox(false)}>
                <X size={16} /> 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CoverCard({ cover, charMap, imageUrl, imageKey, busy, extReady, resolveRefs, onGenerated, onCopy, onJumpChar, buildPromptFor, genPrompt }: {
  cover: StoryCut;
  charMap: Record<string, StoryChar>;
  imageUrl?: string;
  imageKey?: string;
  busy?: boolean;
  extReady?: boolean;
  resolveRefs: (cut: StoryCut) => Promise<{ images: string[]; names: string[]; missing: number }>;
  onGenerated: (dataUrl: string) => void;
  onCopy: (t: string) => void;
  onJumpChar: (id: string) => void;
  buildPromptFor: (base: string) => string;
  genPrompt: string; // cover prompt + parsed script + 3:4 instruction (for generate/copy)
}) {
  const typeLabel = cover.type === "front" ? "앞표지" : cover.type === "back" ? "뒤표지" : cover.type;
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [lightbox, setLightbox] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const handleRef = useRef<GenHandle | null>(null);

  const fileName = `cover_${cover.type || "front"}`;
  const downloadHref = imageKey
    ? `/api/story/download?key=${encodeURIComponent(imageKey)}&name=${encodeURIComponent(fileName)}`
    : imageUrl;

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onGenerated(String(reader.result));
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  // Covers are image-to-image at 3:4 (front/back cover ratio).
  function startGenerate() {
    if (generating) return;
    const prompt = genPrompt;
    if (!prompt.trim()) { setStatusMsg("프롬프트가 비어 있어요."); return; }
    setGenerating(true);
    setStatusMsg("참조 이미지 준비 중…");
    let cancelled = false;
    const composite: GenHandle = {
      promise: (async () => {
        const refs = await resolveRefs(cover);
        if (cancelled) throw new Error("정지됨 (사용자 취소)");
        if (refs.missing) setStatusMsg(`참조 ${refs.images.length}장 사용 (없음 ${refs.missing}) · 생성 중…`);
        const inner = generateViaChatGpt({ prompt, aspect: "3:4", referenceImages: refs.images, referenceNames: refs.names, onProgress: setStatusMsg });
        handleRef.current = inner;
        return await inner.promise;
      })(),
      cancel: () => { cancelled = true; handleRef.current?.cancel(); },
    };
    handleRef.current = composite;
    composite.promise
      .then((dataUrl) => { onGenerated(dataUrl); setStatusMsg(""); })
      .catch((err: unknown) => { setStatusMsg((err as Error)?.message || "생성 실패"); })
      .finally(() => { setGenerating(false); handleRef.current = null; });
  }

  function stopGenerate() {
    handleRef.current?.cancel();
    handleRef.current = null;
    setGenerating(false);
    setStatusMsg("정지됨");
  }

  return (
    <div className="story-cut">
      <div className="story-cut-top">
        <span className="story-cover-badge">{typeLabel}</span>
        <div className="story-cut-refs">
          <RefTags refs={cover.ref} charMap={charMap} onJumpChar={onJumpChar} />
        </div>
      </div>
      <div className="story-cut-body">
        <div className="story-cp-row">
          <div className="story-cp-left">
            <div className="story-prompt">{buildPromptFor(cover.prompt_en || "")}</div>
            {cover.title_area && (
              <div className="story-title-area">
                <Ruler size={14} /> {cover.title_area}
              </div>
            )}
            <div className="story-actions">
              <button
                type="button"
                className="story-mini"
                title="표지 프롬프트 + 본문대본 + 지시문(3:4)을 한 번에 복사"
                onClick={() => onCopy(genPrompt)}
              >
                프롬프트 복사
              </button>
            </div>
          </div>

          <div className="story-cp-imgcol">
            <div className="story-img-stage story-img-stage--cover">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={typeLabel}
                  className="story-img-preview"
                  role="button"
                  title="클릭해서 크게 보기"
                  onClick={() => setLightbox(true)}
                />
              ) : (
                <div className="story-img-empty">
                  <ImagePlus size={28} />
                  <span>표지 이미지를<br />생성 (3:4)</span>
                </div>
              )}
              {generating && <div className="story-img-progress">{statusMsg || "생성 중…"}</div>}
              <button type="button" className="story-img-upload" onClick={() => fileRef.current?.click()}>
                <ImagePlus size={14} /> 이미지 업로드
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
            </div>
            <div className="story-img-actions">
              <button
                type="button"
                className="story-mini"
                onClick={startGenerate}
                disabled={generating || busy || !extReady}
                title={extReady ? "등장 캐릭터를 참조해 3:4로 생성" : "이미지 생성 확장 설치 후 사용 가능"}
              >
                <Sparkles size={14} /> {generating ? "생성 중…" : "이미지 생성"}
              </button>
              <button
                type="button"
                className="story-mini story-mini--ghost"
                onClick={stopGenerate}
                disabled={!generating}
              >
                <Square size={13} /> 정지
              </button>
            </div>
            {statusMsg && !generating && <div className="story-img-msg">{statusMsg}</div>}
          </div>
        </div>
      </div>

      {lightbox && imageUrl && (
        <div
          className="story-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if ((e.target as HTMLElement).classList.contains("story-modal-backdrop")) setLightbox(false); }}
        >
          <div className="story-lightbox">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={fileName} className="story-lightbox__img" />
            <div className="story-lightbox__bar">
              {downloadHref && (
                <a className="story-btn story-btn--apply" href={downloadHref} download={`${fileName}.png`}>
                  <Download size={16} /> 다운로드
                </a>
              )}
              <button type="button" className="story-btn" onClick={() => setLightbox(false)}>
                <X size={16} /> 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
