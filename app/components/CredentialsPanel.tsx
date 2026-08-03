"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, KeyRound, ShieldAlert, Trash2, Upload } from "lucide-react";

/** 키를 발급받는 곳. 새 탭으로 연다 — 작성 중이던 이 화면을 잃지 않게. */
const LINKS = {
  /** 서비스 계정 목록 → "서비스 계정 만들기" → 키 탭에서 JSON 생성 */
  serviceAccounts: "https://console.cloud.google.com/iam-admin/serviceaccounts",
  /** 프로젝트에 Vertex AI API 가 켜져 있어야 호출이 된다 */
  vertexApi:
    "https://console.cloud.google.com/apis/library/aiplatform.googleapis.com",
  aiStudioKey: "https://aistudio.google.com/apikey",
} as const;

/**
 * 자격증명 관리 패널 — 개인용(/settings)과 서버 기본값용(/admin) 이 함께 쓴다.
 * 차이는 안내 문구와, 개인 화면에서만 "서버 기본값으로 동작 중" 을 보여 주는 것뿐.
 *
 * 저장된 비밀값을 다시 읽어 오는 경로는 서버에 없다 — 여기 보이는 건 요약뿐이고,
 * 바꾸려면 새로 올리거나 지우고 넣는다.
 */

type Status = {
  vertex:
    | { configured: false }
    | {
        configured: true;
        projectId: string;
        clientEmail: string;
        updatedAt: number | null;
      };
  aiStudio:
    | { configured: false }
    | { configured: true; masked: string; updatedAt: number | null };
  /** 개인 화면에서만 내려온다. 내 키가 없을 때 서버 기본값이 받쳐 주는지. */
  vertexSource?: "user" | "server" | null;
  aiStudioSource?: "user" | "server" | null;
};

const fmt = (ms: number | null) =>
  ms ? new Date(ms).toLocaleString("ko-KR") : "—";

export default function CredentialsPanel({
  endpoint,
  variant,
}: {
  endpoint: string;
  variant: "user" | "server";
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [apiKey, setApiKey] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(endpoint, { cache: "no-store" });
    if (r.ok) setStatus(await r.json());
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(init: RequestInit, url = endpoint) {
    setBusy(true);
    setError(null);
    const r = await fetch(url, init).catch(() => null);
    const data = await r?.json().catch(() => null);
    if (!r?.ok) {
      setError(data?.error ?? "저장하지 못했어요.");
      setBusy(false);
      return false;
    }
    setStatus(data);
    setBusy(false);
    return true;
  }

  async function onVertexFile(file: File) {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setError("JSON 파일을 읽지 못했어요. 파일이 손상되지 않았는지 확인해 주세요.");
      return;
    }
    await send({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "vertex", serviceAccount: parsed }),
    });
  }

  async function saveApiKey() {
    if (!apiKey.trim()) return;
    const ok = await send({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "ai-studio", apiKey }),
    });
    if (ok) setApiKey("");
  }

  async function remove(kind: "vertex" | "ai-studio") {
    await send({ method: "DELETE" }, `${endpoint}?kind=${kind}`);
  }

  if (!status) return <p className="admin-empty">불러오는 중…</p>;

  const fallback = (source: "user" | "server" | null | undefined) =>
    variant === "user" && source === "server";

  return (
    <div className="cred-view">
      {variant === "user" ? (
        <p className="cred-note cred-note--warn">
          <ShieldAlert size={15} aria-hidden />
          <span>
            여기 넣은 키로 생성한 만큼 <b>본인 계정에 요금이 청구</b>됩니다.
            자격증명은 이 서버에 보관되며 다른 사용자에게 보이지 않습니다.
            관리자도 값을 열어볼 수 없습니다.
          </span>
        </p>
      ) : (
        <p className="cred-note">
          <KeyRound size={15} aria-hidden />
          <span>
            여기 값은 <b>개인 키가 없는 사용자에게만</b> 폴백으로 쓰입니다.
            개인 키를 넣은 사용자는 각자 자기 것으로 동작합니다.
          </span>
        </p>
      )}

      {error && (
        <p className="cred-error" role="alert">
          {error}
        </p>
      )}

      {/* ---- Vertex AI ---- */}
      <section className="cred-card">
        <div className="cred-card__head">
          <h3>Vertex AI — 이미지 생성</h3>
          <span className={`cred-badge${status.vertex.configured ? " is-on" : ""}`}>
            {status.vertex.configured
              ? "설정됨"
              : fallback(status.vertexSource)
                ? "서버 기본값 사용 중"
                : "미설정"}
          </span>
        </div>

        {status.vertex.configured ? (
          <dl className="cred-facts">
            <div>
              <dt>프로젝트</dt>
              <dd>{status.vertex.projectId}</dd>
            </div>
            <div>
              <dt>서비스 계정</dt>
              <dd>{status.vertex.clientEmail}</dd>
            </div>
            <div>
              <dt>저장</dt>
              <dd>{fmt(status.vertex.updatedAt)}</dd>
            </div>
          </dl>
        ) : (
          <>
            <p className="cred-hint">
              Google Cloud 콘솔에서 발급한 <b>서비스 계정 키 JSON</b>을 올려 주세요.
              OAuth 클라이언트 JSON 은 다른 파일이라 받지 않습니다.
              {fallback(status.vertexSource) && (
                <> 지금은 서버 기본 키로 동작하고 있어요.</>
              )}
            </p>
            <ol className="cred-steps">
              <li>
                프로젝트에 <b>Vertex AI API</b>를 켭니다.
                <a
                  className="cred-link"
                  href={LINKS.vertexApi}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  API 켜러 가기 <ExternalLink size={13} aria-hidden />
                </a>
              </li>
              <li>
                <b>서비스 계정</b>을 만들고 <b>Vertex AI User</b> 역할을 줍니다.
              </li>
              <li>
                그 계정의 <b>키 → 키 추가 → JSON</b> 으로 파일을 내려받아 아래에
                올립니다.
                <a
                  className="cred-link"
                  href={LINKS.serviceAccounts}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  서비스 계정 만들러 가기 <ExternalLink size={13} aria-hidden />
                </a>
              </li>
            </ol>
          </>
        )}

        <div className="cred-actions">
          <label className="cred-upload">
            <Upload size={16} aria-hidden />
            {status.vertex.configured ? "다른 파일로 교체" : "JSON 파일 올리기"}
            <input
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void onVertexFile(f);
              }}
            />
          </label>
          {status.vertex.configured && (
            <button
              type="button"
              className="cred-remove"
              disabled={busy}
              onClick={() => void remove("vertex")}
            >
              <Trash2 size={16} aria-hidden /> 지우기
            </button>
          )}
        </div>
      </section>

      {/* ---- Google AI Studio ---- */}
      <section className="cred-card">
        <div className="cred-card__head">
          <h3>Google AI Studio — 대본·자막</h3>
          <span className={`cred-badge${status.aiStudio.configured ? " is-on" : ""}`}>
            {status.aiStudio.configured
              ? "설정됨"
              : fallback(status.aiStudioSource)
                ? "서버 기본값 사용 중"
                : "미설정"}
          </span>
        </div>

        {status.aiStudio.configured ? (
          <dl className="cred-facts">
            <div>
              <dt>키</dt>
              <dd className="cred-mono">{status.aiStudio.masked}</dd>
            </div>
            <div>
              <dt>저장</dt>
              <dd>{fmt(status.aiStudio.updatedAt)}</dd>
            </div>
          </dl>
        ) : (
          <>
            <p className="cred-hint">
              Google AI Studio 에서 API 키를 발급받아 넣어 주세요. 무료 티어라
              Vertex 크레딧을 쓰지 않습니다.
              {fallback(status.aiStudioSource) && (
                <> 지금은 서버 기본 키로 동작하고 있어요.</>
              )}
            </p>
            <p className="cred-linkrow">
              <a
                className="cred-link"
                href={LINKS.aiStudioKey}
                target="_blank"
                rel="noopener noreferrer"
              >
                API 키 발급받으러 가기 <ExternalLink size={13} aria-hidden />
              </a>
            </p>
          </>
        )}

        <div className="cred-actions">
          <input
            className="cred-input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              status.aiStudio.configured ? "새 키로 교체" : "API 키 붙여넣기"
            }
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
          />
          <button
            type="button"
            className="cred-save"
            disabled={busy || !apiKey.trim()}
            onClick={() => void saveApiKey()}
          >
            저장
          </button>
          {status.aiStudio.configured && (
            <button
              type="button"
              className="cred-remove"
              disabled={busy}
              onClick={() => void remove("ai-studio")}
            >
              <Trash2 size={16} aria-hidden /> 지우기
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
