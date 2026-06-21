// Service worker: routes jobs from the tbbook page (via bridge.js) to a
// chatgpt.com tab (chatgpt.js), and relays status back to the page's tab.
//
// jobId → { pageTabId, chatgptTabId }
const JOBS = new Map();

// A plain chat tab can use the image tool; "/g/" custom GPTs and settings can't.
function isUsable(url) {
  try {
    const p = new URL(url).pathname;
    return p === "/" || p.startsWith("/c/");
  } catch {
    return false;
  }
}

async function findUsableTab() {
  const tabs = await chrome.tabs.query({ url: ["https://chatgpt.com/*", "https://chat.openai.com/*"] });
  const t = tabs.find((x) => isUsable(x.url));
  return t ? t.id : null;
}

function waitForTabComplete(tabId, timeoutMs = 25000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const check = async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === "complete") return resolve();
      } catch {
        return resolve();
      }
      if (Date.now() - t0 > timeoutMs) return resolve();
      setTimeout(check, 400);
    };
    check();
  });
}

async function openFreshTab() {
  const created = await chrome.tabs.create({ url: "https://chatgpt.com/", active: true });
  await waitForTabComplete(created.id);
  return created.id;
}

// Send to a tab's content script, retrying until it's listening (a fresh tab
// needs a moment before chatgpt.js is injected). Rejects if never reachable.
async function sendToTab(tabId, msg, tries) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await chrome.tabs.sendMessage(tabId, msg);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastErr || new Error("연결 실패");
}

function statusToPage(pageTabId, jobId, status, extra = {}) {
  if (pageTabId == null) return;
  chrome.tabs.sendMessage(pageTabId, { type: "tbbook-status", jobId, status, ...extra }).catch(() => {});
}

async function dispatch(jobId, prompt, aspect, referenceImages, pageTabId) {
  const runMsg = { type: "tbbook-run", jobId, prompt, aspect, referenceImages: referenceImages || [] };

  // 1) Try an existing plain-chat tab first (short retry — it's either live or stale).
  const existing = await findUsableTab();
  if (existing != null) {
    JOBS.set(jobId, { pageTabId, chatgptTabId: existing });
    try {
      await sendToTab(existing, runMsg, 6);
      await chrome.tabs.update(existing, { active: true }).catch(() => {});
      return;
    } catch {
      /* stale/orphaned content script → fall through to a fresh tab */
    }
  }

  // 2) Open a fresh chatgpt.com tab and run there.
  statusToPage(pageTabId, jobId, "progress", { message: "ChatGPT 탭 여는 중…" });
  const fresh = await openFreshTab();
  JOBS.set(jobId, { pageTabId, chatgptTabId: fresh });
  await sendToTab(fresh, runMsg, 50);
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg) return;

  // From the tbbook page (bridge.js)
  if (msg.type === "tbbook-generate") {
    const pageTabId = sender.tab && sender.tab.id;
    const jobId = msg.jobId;
    (async () => {
      try {
        statusToPage(pageTabId, jobId, "progress", { message: "ChatGPT 탭 준비 중…" });
        await dispatch(jobId, msg.prompt, msg.aspect, msg.referenceImages, pageTabId);
      } catch (e) {
        statusToPage(pageTabId, jobId, "error", { message: "ChatGPT 탭에 연결할 수 없어요 — chatgpt.com 로그인 후 다시 시도하세요. (" + ((e && e.message) || e) + ")" });
        JOBS.delete(jobId);
      }
    })();
    return;
  }

  if (msg.type === "tbbook-cancel") {
    const job = JOBS.get(msg.jobId);
    if (job) chrome.tabs.sendMessage(job.chatgptTabId, { type: "tbbook-cancel", jobId: msg.jobId }).catch(() => {});
    return;
  }

  // From the chatgpt.com tab (chatgpt.js)
  if (msg.type === "tbbook-status") {
    const job = JOBS.get(msg.jobId);
    if (!job) return;
    if (msg.status === "need-login" && job.chatgptTabId != null) {
      chrome.tabs.update(job.chatgptTabId, { active: true }).catch(() => {});
    }
    statusToPage(job.pageTabId, msg.jobId, msg.status, { message: msg.message, dataUrl: msg.dataUrl });
    if (msg.status === "done" || msg.status === "error") JOBS.delete(msg.jobId);
    return;
  }
});
