// Content script injected into the tbbook web app (localhost + tbbook.aitoolb.com).
// Relays messages between the page (window.postMessage) and the extension
// background (chrome.runtime). The page never touches chrome APIs directly — it
// only speaks the window.postMessage protocol below, so it stays pure web code.
//
// Page → ext:  { source: "tbbook-story", kind: "ping" | "generate" | "cancel", id, prompt, aspect }
// Ext → page:  { source: "tbbook-ext", type: "ready" | "pong" | "progress" | "done" | "error" | "need-login", id, message, dataUrl }
(() => {
  // True only while this content script is still bound to a live extension.
  // After the extension is reloaded/updated, chrome.runtime.id becomes undefined
  // and any sendMessage call throws "Extension context invalidated".
  const alive = () => {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch { return false; }
  };
  const toPage = (payload) => window.postMessage({ source: "tbbook-ext", ...payload }, "*");
  const STALE_MSG = "확장이 새로고침됐어요. 이 페이지를 새로고침(Cmd+R)한 뒤 다시 시도하세요.";

  // Page → background
  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.source !== "tbbook-story") return;

    if (d.kind === "ping") {
      if (alive()) toPage({ type: "pong" });
      return;
    }
    if (!alive()) {
      // Only surface an error for an actual generate request, not background pings.
      if (d.kind === "generate") toPage({ id: d.id, type: "error", message: STALE_MSG });
      return;
    }
    try {
      if (d.kind === "generate") {
        chrome.runtime.sendMessage({ type: "tbbook-generate", jobId: d.id, prompt: d.prompt || "", aspect: d.aspect || "16:9", referenceImages: d.referenceImages || [] });
      } else if (d.kind === "cancel") {
        chrome.runtime.sendMessage({ type: "tbbook-cancel", jobId: d.id });
      }
    } catch {
      if (d.kind === "generate") toPage({ id: d.id, type: "error", message: STALE_MSG });
    }
  });

  // Background → page
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || msg.type !== "tbbook-status") return;
      toPage({ id: msg.jobId, type: msg.status, message: msg.message, dataUrl: msg.dataUrl });
    });
  } catch { /* extension already gone */ }

  // Announce presence so the page can enable the ChatGPT engine.
  if (alive()) toPage({ type: "ready" });
})();
