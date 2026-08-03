"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Trash2, Upload } from "lucide-react";

/**
 * 외부 AI 자격증명 관리 화면 (관리자 전용).
 *
 * 저장된 비밀값을 다시 읽어 오는 경로는 서버에 없다 — 여기서 보이는 건 상태
 * 요약뿐이고, 바꾸려면 새로 올리거나 지우고 다시 넣는다.
 */

type Status = {
  vertex:
    | { configured: false; source: null }
    | {
        configured: true;
        source: "file" | "env";
        projectId: string;
        clientEmail: string;
        updatedAt: number | null;
      };
  aiStudio:
    | { configured: false; source: null }
    | {
        configured: true;
        source: "file" | "env";
        masked: string;
        updatedAt: number | null;
      };
};

const fmt = (ms: number | null) =>
  ms ? new Date(ms).toLocaleString("ko-KR") : "—";

export default function CredentialsView() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [apiKey, setApiKey] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/credentials", { cache: "no-store" });
    if (r.ok) setStatus(await r.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(init: RequestInit, url = "/api/admin/credentials") {
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
    await send({ method: "DELETE" }, `/api/admin/credentials?kind=${kind}`);
  }

  if (!status) return <p className="admin-empty">불러오는 중…</p>;

  return (
    <div className="cred-view">
      <p className="cred-note">
        <KeyRound size={15} aria-hidden />
        자격증명은 리포지토리와 책 저장소 바깥의 별도 폴더에 소유자만 읽을 수
        있는 권한으로 보관됩니다. 저장한 값은 다시 볼 수 없고, 바꾸려면 새로
        넣거나 지우면 됩니다.
      </p>

      {error && (
        <p className="cred-error" role="alert">
          {error}
        </p>
      )}

      {/* ---- Vertex AI ---- */}
      <section className="cred-card">
        <div className="cred-card__head">
          <h3>Vertex AI — 이미지 생성</h3>
          <span
            className={`cred-badge${status.vertex.configured ? " is-on" : ""}`}
          >
            {status.vertex.configured ? "설정됨" : "미설정"}
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
              <dd>
                {status.vertex.source === "env"
                  ? "환경변수 (GOOGLE_APPLICATION_CREDENTIALS)"
                  : fmt(status.vertex.updatedAt)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="cred-hint">
            Google Cloud 콘솔에서 발급한 <b>서비스 계정 키 JSON</b>을 올려
            주세요. OAuth 클라이언트 JSON 은 다른 파일이라 받지 않습니다.
          </p>
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
          {status.vertex.configured && status.vertex.source === "file" && (
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
          <span
            className={`cred-badge${status.aiStudio.configured ? " is-on" : ""}`}
          >
            {status.aiStudio.configured ? "설정됨" : "미설정"}
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
              <dd>
                {status.aiStudio.source === "env"
                  ? "환경변수 (GOOGLE_AI_STUDIO_API_KEY)"
                  : fmt(status.aiStudio.updatedAt)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="cred-hint">
            aistudio.google.com 에서 발급한 API 키를 넣어 주세요. 무료 티어라
            Vertex 크레딧을 쓰지 않습니다.
          </p>
        )}

        <div className="cred-actions">
          <input
            className="cred-input"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={status.aiStudio.configured ? "새 키로 교체" : "API 키 붙여넣기"}
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
          {status.aiStudio.configured && status.aiStudio.source === "file" && (
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
