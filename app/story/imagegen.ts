"use client";

/**
 * Client helpers for the /story image generation.
 *  - generateViaApi: Path A — server route (OpenAI / fal). No extension needed.
 *  - generateViaChatGpt: Path B — talks to the TB Magic Book Chrome extension via
 *    window.postMessage (bridge.js). The extension drives chatgpt.com or Google
 *    Flow (labs.google) and returns the image. If the extension isn't installed,
 *    isExtensionReady() is false.
 *
 * Both return { promise, cancel } so the "정지" button can abort.
 */

export type Aspect = "1:1" | "3:4" | "4:3" | "16:9" | "9:16";
export type Engine = "api" | "chatgpt";
/** 확장이 자동화하는 생성 사이트. 페이지 상단 토글로 고르며 모든 생성 버튼(단건/전체)에 적용. */
export type ExtEngine = "chatgpt" | "flow";
export type GenHandle = { promise: Promise<string>; cancel: () => void };

const ENGINE_STORE_KEY = "tbbook:gen-engine";

export function getGenEngine(): ExtEngine {
  if (typeof window === "undefined") return "chatgpt";
  try { return localStorage.getItem(ENGINE_STORE_KEY) === "flow" ? "flow" : "chatgpt"; } catch { return "chatgpt"; }
}

export function setGenEngine(engine: ExtEngine) {
  try { localStorage.setItem(ENGINE_STORE_KEY, engine); } catch { /* ignore */ }
}

// ChatGPT가 인터페이스를 바꿔 확장(chatgpt.js)의 사이즈 드롭다운 클릭이 더 이상
// 통하지 않는다. 그래서 가로세로비율을 프롬프트 본문 끝에 한국어 지시로 붙여
// ChatGPT가 텍스트에서 직접 비율을 잡게 한다.
export function withAspectInstruction(prompt: string, aspect: Aspect): string {
  const p = (prompt || "").trimEnd();
  return `${p}\n\n가로세로비율 ${aspect}사이즈로 이미지 만들어줘`;
}

// ---- Path A: server API ----
export function generateViaApi(opts: {
  prompt: string;
  aspect: Aspect;
  provider?: "openai" | "fal";
}): GenHandle {
  const ctrl = new AbortController();
  const promise = (async () => {
    const r = await fetch("/api/story/generate-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: opts.prompt, aspect: opts.aspect, provider: opts.provider }),
      signal: ctrl.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || `요청 실패 (${r.status})`);
    if (!data?.dataUrl) throw new Error("이미지를 받지 못했어요.");
    return data.dataUrl as string;
  })();
  return { promise, cancel: () => ctrl.abort() };
}

// ---- Path B: ChatGPT via extension (window.postMessage bridge) ----
type ExtMsg = {
  source?: string;
  type?: string;
  id?: string;
  message?: string;
  dataUrl?: string;
  version?: string;
};

/** Resolves true if the TB Magic Book extension's bridge content script is present. */
export function isExtensionReady(timeoutMs = 600): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMsg);
      resolve(v);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data as ExtMsg;
      if (d?.source === "tbbook-ext" && (d.type === "pong" || d.type === "ready")) finish(true);
    };
    window.addEventListener("message", onMsg);
    window.postMessage({ source: "tbbook-story", kind: "ping" }, "*");
    setTimeout(() => finish(false), timeoutMs);
  });
}

/** Installed extension version, read from its pong/ready handshake. Resolves
 * null if the extension isn't present (no reply within the timeout). Used to
 * compare against /api/ext/latest and show an "업데이트 필요" banner. */
export function getExtVersion(timeoutMs = 800): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMsg);
      resolve(v);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data as ExtMsg;
      if (d?.source === "tbbook-ext" && (d.type === "pong" || d.type === "ready") && d.version) finish(d.version);
    };
    window.addEventListener("message", onMsg);
    window.postMessage({ source: "tbbook-story", kind: "ping" }, "*");
    setTimeout(() => finish(null), timeoutMs);
  });
}

export function generateViaChatGpt(opts: {
  prompt: string;
  aspect: Aspect;
  referenceImages?: string[]; // data URLs for image-to-image (cut generation)
  onProgress?: (msg: string) => void;
  /** 미지정 시 페이지 토글(localStorage)의 현재 엔진을 따른다. */
  engine?: ExtEngine;
}): GenHandle {
  const engine = opts.engine || getGenEngine();
  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let settled = false;
  let onMsg: ((e: MessageEvent) => void) | null = null;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  // Captured so cancel() can reject the promise — otherwise an awaiting caller
  // (the 전체생성 loop) hangs forever and never resets its busy state.
  let rejectFn: ((reason: Error) => void) | null = null;
  const cleanup = () => {
    if (onMsg) window.removeEventListener("message", onMsg);
    if (watchdog) clearTimeout(watchdog);
  };

  const promise = new Promise<string>((resolve, reject) => {
    rejectFn = reject;
    // If no message arrives for a while, the extension isn't responding (stale
    // context, not installed on this tab, etc.) — fail instead of hanging.
    // Reset on every message so long generations don't trip it. The window is
    // generous because jobs run in BACKGROUND ChatGPT tabs, whose timers Chrome
    // throttles (down to ~once/min after 5 min hidden); chatgpt.js sends a
    // heartbeat every poll so this only fires when the tab is truly dead.
    const arm = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        if (settled) return;
        settled = true; cleanup();
        reject(new Error(engine === "flow"
          ? "확장이 응답하지 않아요. 페이지를 새로고침(Cmd+R)했는지, labs.google(구글)에 로그인돼 있는지 확인하세요."
          : "확장이 응답하지 않아요. 페이지를 새로고침(Cmd+R)했는지, ChatGPT에 로그인돼 있는지 확인하세요."));
      }, 180000);
    };
    onMsg = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data as ExtMsg;
      if (d?.source !== "tbbook-ext" || d.id !== id) return;
      arm();
      if (d.type === "progress") opts.onProgress?.(d.message || "");
      else if (d.type === "need-login") opts.onProgress?.(d.message || "ChatGPT 로그인이 필요해요.");
      else if (d.type === "done") { settled = true; cleanup(); resolve(d.dataUrl || ""); }
      else if (d.type === "error") { settled = true; cleanup(); reject(new Error(d.message || "생성 실패")); }
    };
    window.addEventListener("message", onMsg);
    // Flow 는 확장이 tune 패널에서 화면비율을 직접 설정하므로 프롬프트에 비율
    // 지시문을 붙이지 않는다 (ChatGPT 만 텍스트로 비율을 잡음).
    const prompt = engine === "flow" ? opts.prompt : withAspectInstruction(opts.prompt, opts.aspect);
    window.postMessage({ source: "tbbook-story", kind: "generate", id, prompt, aspect: opts.aspect, referenceImages: opts.referenceImages || [], engine }, "*");
    arm();
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      window.postMessage({ source: "tbbook-story", kind: "cancel", id }, "*");
      cleanup();
      rejectFn?.(new Error("정지됨 (사용자 취소)"));
    },
  };
}
