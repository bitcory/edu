"use client";

/**
 * Client helpers for the /story image generation.
 *  - generateViaApi: Path A — server route (OpenAI / fal). No extension needed.
 *  - generateViaChatGpt: Path B — talks to the TB Magic Book Chrome extension via
 *    window.postMessage (bridge.js). The extension drives chatgpt.com and returns
 *    the image. If the extension isn't installed, isExtensionReady() is false.
 *
 * Both return { promise, cancel } so the "정지" button can abort.
 */

export type Aspect = "1:1" | "3:4" | "4:3" | "16:9" | "9:16";
export type Engine = "api" | "chatgpt";
export type GenHandle = { promise: Promise<string>; cancel: () => void };

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

export function generateViaChatGpt(opts: {
  prompt: string;
  aspect: Aspect;
  referenceImages?: string[]; // data URLs for image-to-image (cut generation)
  onProgress?: (msg: string) => void;
}): GenHandle {
  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let settled = false;
  let onMsg: ((e: MessageEvent) => void) | null = null;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  const cleanup = () => {
    if (onMsg) window.removeEventListener("message", onMsg);
    if (watchdog) clearTimeout(watchdog);
  };

  const promise = new Promise<string>((resolve, reject) => {
    // If no message arrives for a while, the extension isn't responding (stale
    // context, not installed on this tab, etc.) — fail instead of hanging.
    // Reset on every message so long generations don't trip it.
    const arm = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        if (settled) return;
        settled = true; cleanup();
        reject(new Error("확장이 응답하지 않아요. 페이지를 새로고침(Cmd+R)했는지, ChatGPT에 로그인돼 있는지 확인하세요."));
      }, 30000);
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
    window.postMessage({ source: "tbbook-story", kind: "generate", id, prompt: opts.prompt, aspect: opts.aspect, referenceImages: opts.referenceImages || [] }, "*");
    arm();
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      window.postMessage({ source: "tbbook-story", kind: "cancel", id }, "*");
      cleanup();
    },
  };
}
