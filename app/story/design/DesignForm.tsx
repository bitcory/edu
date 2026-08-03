"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Plus, Trash2, Wand2 } from "lucide-react";
import type { Issue, PictureBook } from "../../lib/picturebook-schema";
import {
  ART_STYLES,
  EMPTY_BRIEF,
  MAKE_MODES,
  MOODS,
  MOTION_PLANS,
  THEMES,
  buildStyleBlock,
  briefSummary,
  type DesignBrief,
} from "../../lib/design-brief";
import {
  AGE_PRESETS,
  cutCountIssue,
  type PbTheme,
} from "../../lib/picturebook-schema";

/**
 * 그림책 설계 입력 화면.
 *
 * 지침의 0~7단계를 대화가 아니라 탭으로 편다. 대화형은 한 번에 하나만 물어
 * 되돌아가기가 번거로운데, 여기서는 아무 탭이나 오가며 고칠 수 있다.
 * 값은 로컬에 저장돼 새로고침해도 남는다.
 */

const STORE_KEY = "tbbook:design-brief-v1";

const TABS = [
  { id: "basic", label: "기본" },
  { id: "art", label: "그림체" },
  { id: "cast", label: "등장인물" },
  { id: "cuts", label: "컷 구성" },
  { id: "review", label: "확인" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const MOTION_FIT_NOTE: Record<string, string> = {
  great: "움직임에 가장 잘 맞아요",
  good: "움직임도 잘 어울려요",
  ok: "",
  poor: "움직이면 어색해질 수 있어요",
};

/** /story 가 읽는 저장 키. 설계 결과를 여기에 넣으면 그대로 열린다. */
const STORY_CACHE_KEY = "toolb_step8_picbook_v1";
const STORY_SCRIPT_KEY = "toolb_step8_script_v1";
const STORY_SCRIPT_INPUT_KEY = "toolb_step8_script_input_v1";

type DesignResult = {
  ok: boolean;
  book: PictureBook;
  body: { no: number; text: string }[];
  titleCandidates: string[];
  issues: Issue[];
  model: string;
};

export default function DesignForm() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("basic");
  const [brief, setBrief] = useState<DesignBrief>(EMPTY_BRIEF);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DesignResult | null>(null);

  // 저장된 값 복원 — 설계는 한 번에 끝나지 않아서 새로고침에도 남아야 한다.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setBrief({ ...EMPTY_BRIEF, ...JSON.parse(raw) });
    } catch {
      /* 무시 */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(brief));
    } catch {
      /* 무시 */
    }
  }, [brief, loaded]);

  const set = <K extends keyof DesignBrief>(key: K, value: DesignBrief[K]) =>
    setBrief((b) => ({ ...b, [key]: value }));

  /** 연령을 바꾸면 컷 수 기본값도 따라간다 — 직접 만진 뒤에는 건드리지 않는다. */
  function setAge(ageId: string) {
    const preset = AGE_PRESETS.find((a) => a.id === ageId);
    setBrief((b) => {
      const wasDefault =
        AGE_PRESETS.find((a) => a.id === b.age)?.defaultCuts === b.cutCount;
      return {
        ...b,
        age: ageId,
        cutCount: wasDefault && preset ? preset.defaultCuts : b.cutCount,
      };
    });
  }

  async function generate() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/story/design", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    // 모델 실패는 200 + { error } 로 온다 (Cloudflare 가 5xx 본문을 버리기 때문).
    if (!res?.ok || !data || data.error) {
      setError(data?.error ?? "설계에 실패했어요. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
      return;
    }
    setResult(data as DesignResult);
    setBusy(false);
  }

  /** 결과를 스토리구성 화면이 읽는 자리에 넣고 이동한다. */
  function sendToStory() {
    if (!result) return;
    const script = result.body.map((b) => `[${b.no}] ${b.text}`).join("\n\n");
    try {
      localStorage.setItem(
        STORY_CACHE_KEY,
        JSON.stringify({
          library_meta: { name: result.book.meta.title, count: 1 },
          books: [result.book],
        }),
      );
      localStorage.setItem(STORY_SCRIPT_KEY, script);
      localStorage.setItem(STORY_SCRIPT_INPUT_KEY, script);
    } catch {
      setError("결과를 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.");
      return;
    }
    router.push("/story");
  }

  const cutWarn = cutCountIssue(brief.age, brief.cutCount);
  const styleBlock = useMemo(() => buildStyleBlock(brief), [brief]);

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!brief.seed.trim()) m.push("이야기 씨앗");
    if (brief.mode === "adapt" && !brief.source.trim()) m.push("원작 이름");
    if (!brief.autoCharacters && brief.characters.length === 0)
      m.push("등장인물 (자동으로 두거나 직접 넣기)");
    return m;
  }, [brief]);

  if (!loaded) return <p className="admin-empty">불러오는 중…</p>;

  return (
    <div className="design-body">
      <nav className="design-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`design-tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ---------------- 기본 ---------------- */}
      {tab === "basic" && (
        <div className="design-pane">
          <Field label="어떻게 만들까요?">
            <div className="design-choices">
              {MAKE_MODES.map((m) => (
                <Choice
                  key={m.id}
                  active={brief.mode === m.id}
                  onClick={() => set("mode", m.id)}
                  title={m.label}
                  desc={m.desc}
                />
              ))}
            </div>
          </Field>

          {brief.mode === "adapt" && (
            <Field label="원작 이름" hint="예: 콩쥐팥쥐, 아기돼지 삼형제">
              <input
                className="design-input"
                value={brief.source}
                onChange={(e) => set("source", e.target.value)}
                placeholder="각색할 원작"
              />
            </Field>
          )}

          <Field label="누구를 위한 이야기인가요?">
            <div className="design-choices design-choices--row">
              {AGE_PRESETS.map((a) => (
                <Choice
                  key={a.id}
                  active={brief.age === a.id}
                  onClick={() => setAge(a.id)}
                  title={a.label}
                  desc={`${a.cuts[0]}~${a.cuts[1]}컷`}
                />
              ))}
            </div>
          </Field>

          <Field
            label="어떤 이야기를 만들까요?"
            hint="상황을 자유롭게 적어 주세요. 예: 어두운 방에 혼자 자러 가는 게 무서운 아이"
          >
            <textarea
              className="design-textarea"
              rows={4}
              value={brief.seed}
              onChange={(e) => set("seed", e.target.value)}
              placeholder="떠오르는 상황을 적어 주세요"
            />
          </Field>

          <Field label="이야기 분위기">
            <div className="design-choices">
              {MOODS.map((m) => (
                <Choice
                  key={m.id}
                  active={brief.mood === m.id}
                  onClick={() => set("mood", m.id)}
                  title={m.label}
                  desc={m.desc}
                />
              ))}
            </div>
          </Field>
        </div>
      )}

      {/* ---------------- 그림체 ---------------- */}
      {tab === "art" && (
        <div className="design-pane">
          <Field
            label="나중에 영상으로도 만드실 계획인가요?"
            hint="화풍에 따라 움직였을 때 어색해지는 것이 있어서 먼저 여쭤봅니다."
          >
            <div className="design-choices design-choices--row">
              {MOTION_PLANS.map((m) => (
                <Choice
                  key={m.id}
                  active={brief.motion === m.id}
                  onClick={() => set("motion", m.id)}
                  title={m.label}
                />
              ))}
            </div>
          </Field>

          <Field label="그림 스타일">
            <div className="design-choices">
              {ART_STYLES.map((s) => {
                const note =
                  brief.motion === "motion" ? MOTION_FIT_NOTE[s.motionFit] : "";
                return (
                  <Choice
                    key={s.id}
                    active={brief.artStyle === s.id}
                    onClick={() => set("artStyle", s.id)}
                    title={s.label}
                    desc={[s.desc, note].filter(Boolean).join(" · ")}
                    warn={brief.motion === "motion" && s.motionFit === "poor"}
                  />
                );
              })}
            </div>
          </Field>

          <Field label="뷰어 색 테마" hint="완성된 책을 볼 때의 배경 색감입니다.">
            <div className="design-choices design-choices--row">
              {THEMES.map((t) => (
                <Choice
                  key={t.id}
                  active={brief.theme === t.id}
                  onClick={() => set("theme", t.id as PbTheme)}
                  title={t.label}
                />
              ))}
            </div>
          </Field>
        </div>
      )}

      {/* ---------------- 등장인물 ---------------- */}
      {tab === "cast" && (
        <div className="design-pane">
          <label className="design-check">
            <input
              type="checkbox"
              checked={brief.autoCharacters}
              onChange={(e) => set("autoCharacters", e.target.checked)}
            />
            <span>이야기에 맞춰 등장인물을 자동으로 정해 주세요</span>
          </label>

          {!brief.autoCharacters && (
            <>
              <p className="design-hint">
                식별 포인트는 컷마다 같은 인물로 보이게 하는 기준입니다. 색과
                형태처럼 눈에 바로 띄는 것을 적어 주세요.
              </p>
              {brief.characters.map((c, i) => (
                <div className="design-cast" key={i}>
                  <input
                    className="design-input"
                    value={c.name}
                    placeholder="이름 (예: 카피)"
                    onChange={(e) => {
                      const next = [...brief.characters];
                      next[i] = { ...c, name: e.target.value };
                      set("characters", next);
                    }}
                  />
                  <input
                    className="design-input"
                    value={c.role}
                    placeholder="역할 (주인공·조력자)"
                    onChange={(e) => {
                      const next = [...brief.characters];
                      next[i] = { ...c, role: e.target.value };
                      set("characters", next);
                    }}
                  />
                  <input
                    className="design-input"
                    value={c.idPoint}
                    placeholder="식별 포인트 (예: 선명한 빨간 털)"
                    onChange={(e) => {
                      const next = [...brief.characters];
                      next[i] = { ...c, idPoint: e.target.value };
                      set("characters", next);
                    }}
                  />
                  <button
                    type="button"
                    className="design-iconbtn"
                    aria-label="삭제"
                    onClick={() =>
                      set(
                        "characters",
                        brief.characters.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="design-add"
                onClick={() =>
                  set("characters", [
                    ...brief.characters,
                    { name: "", role: "", idPoint: "" },
                  ])
                }
              >
                <Plus size={16} /> 인물 추가
              </button>
            </>
          )}
        </div>
      )}

      {/* ---------------- 컷 구성 ---------------- */}
      {tab === "cuts" && (
        <div className="design-pane">
          <Field
            label="컷 수"
            hint="한 컷 = 한 페이지 = 핵심 행동 하나. 수를 맞추려고 사건을 늘리지는 않습니다."
          >
            <div className="design-inline">
              <input
                className="design-input design-input--num"
                type="number"
                min={1}
                max={40}
                value={brief.cutCount}
                onChange={(e) => set("cutCount", Number(e.target.value) || 1)}
              />
              <span className="design-unit">컷</span>
            </div>
            {cutWarn && <p className="design-warn">{cutWarn}</p>}
          </Field>

          <Field
            label="제목"
            hint="비워 두면 이야기를 보고 후보를 만들어 드려요."
          >
            <input
              className="design-input"
              value={brief.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="직접 정하고 싶으면 적어 주세요"
            />
          </Field>

          <Field
            label="한 줄 메시지"
            hint="교훈 설명이 아니라, 책을 덮고 남는 한 문장입니다. 비우면 자동으로 만듭니다."
          >
            <input
              className="design-input"
              value={brief.message}
              onChange={(e) => set("message", e.target.value)}
              placeholder="예: 혼자가 아니라서 다행이야."
            />
          </Field>
        </div>
      )}

      {/* ---------------- 확인 ---------------- */}
      {tab === "review" && (
        <div className="design-pane">
          <p className="design-summary">{briefSummary(brief)}</p>

          {brief.seed && (
            <Field label="이야기">
              <p className="design-readout">{brief.seed}</p>
            </Field>
          )}

          <Field
            label="고정되는 스타일 지시"
            hint="여백·글자 금지 규칙은 실패가 잦은 부분이라 입력값에서 자동으로 조립합니다. 모델이 바꾸지 못합니다."
          >
            <pre className="design-code">{styleBlock.common}</pre>
            <pre className="design-code design-code--dim">
              {styleBlock.scene_add}
            </pre>
          </Field>

          {missing.length > 0 ? (
            <p className="design-warn">
              아직 비어 있어요: {missing.join(", ")}
            </p>
          ) : (
            <p className="design-ready">
              <Check size={16} /> 설계에 필요한 값이 모두 준비됐어요.
            </p>
          )}

          <button
            type="button"
            className="design-go"
            disabled={missing.length > 0 || busy}
            onClick={() => void generate()}
          >
            <Wand2 size={20} />
            {busy ? "설계하는 중… (1~3분)" : "이 설정으로 설계하기"}
          </button>
          {busy && (
            <p className="design-hint">
              본문을 먼저 쓰고, 그걸 근거로 캐릭터 시트와 컷 프롬프트를 만듭니다.
              컷이 많으면 시간이 걸려요.
            </p>
          )}
          {error && (
            <p className="design-warn" role="alert">
              {error}
            </p>
          )}

          {result && (
            <div className="design-result">
              <h3 className="design-label">{result.book.meta.title}</h3>
              <p className="design-hint">
                {result.book.meta.message} · 캐릭터 {result.book.characters.length}명
                · {result.book.cuts.length}컷 · 표지 {result.book.covers.length}장
                · {result.model}
              </p>

              {result.ok ? (
                <p className="design-ready">
                  <Check size={16} /> 규칙 검사를 통과했어요.
                </p>
              ) : (
                <p className="design-warn">
                  <AlertTriangle size={14} /> 규칙 위반이 남아 있어요. 아래를
                  확인하고 다시 설계해 보세요.
                </p>
              )}

              {result.issues.length > 0 && (
                <details className="design-issues">
                  <summary>
                    검사 결과 {result.issues.filter((i) => i.level === "error").length}건
                    에러 · {result.issues.filter((i) => i.level === "warn").length}건 경고
                  </summary>
                  <ul>
                    {result.issues.slice(0, 40).map((i, n) => (
                      <li key={n} className={i.level === "error" ? "is-error" : ""}>
                        <code>{i.path}</code> {i.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <details className="design-issues">
                <summary>본문 미리보기</summary>
                <ol className="design-bodylist">
                  {result.body.map((b) => (
                    <li key={b.no}>{b.text}</li>
                  ))}
                </ol>
              </details>

              <button type="button" className="design-go" onClick={sendToStory}>
                스토리구성에 넣기
              </button>
              <p className="design-hint">
                넣으면 <Link href="/story">스토리구성</Link> 의 캐릭터 시트·본문
                컷이 이 결과로 바뀝니다. 기존 내용은 덮어써집니다.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- 작은 조각들 ---------------- */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="design-field">
      <h3 className="design-label">{label}</h3>
      {hint && <p className="design-hint">{hint}</p>}
      {children}
    </section>
  );
}

function Choice({
  active,
  onClick,
  title,
  desc,
  warn,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc?: string;
  warn?: boolean;
}) {
  return (
    <button
      type="button"
      className={`design-choice${active ? " is-active" : ""}${warn ? " is-warn" : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="design-choice__title">{title}</span>
      {desc && <span className="design-choice__desc">{desc}</span>}
    </button>
  );
}
