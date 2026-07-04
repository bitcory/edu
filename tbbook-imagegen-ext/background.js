// Service worker: routes jobs from the tbbook page (via bridge.js) to a
// generation tab — chatgpt.com (chatgpt.js) or Google Flow (flow.js) — and
// relays status back to the page's tab.
//
// jobId → { pageTabId, genTabId }
const JOBS = new Map();

// Engine → generation page URL. Flow 는 /tools/flow 경로여야 flow-main.js 가
// 프로젝트 진입/생성을 자동화할 수 있다 (locale 리다이렉트는 상관없음).
const ENGINE_URL = {
  chatgpt: "https://chatgpt.com/",
  flow: "https://labs.google/fx/ko/tools/flow",
};

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

// Jobs run one at a time in a dedicated separate window (not background tabs
// of the user's window): a visible active tab isn't timer-throttled by Chrome
// and behaves like a normal user session, which avoids ChatGPT bot suspicion.
// The window is reused across jobs; finished tabs stay open for review.
let genWindowId = null;

chrome.windows.onRemoved.addListener((id) => {
  if (id === genWindowId) genWindowId = null;
});

async function openFreshTab(url) {
  let tabId = null;
  if (genWindowId != null) {
    try {
      await chrome.windows.get(genWindowId);
      const tab = await chrome.tabs.create({ windowId: genWindowId, url, active: true });
      tabId = tab.id;
    } catch {
      genWindowId = null;
    }
  }
  if (tabId == null) {
    // focused:false — 새 창은 띄우되 사용자가 보고 있는 창의 키보드 포커스는 뺏지 않는다.
    const w = await chrome.windows.create({ url, focused: false });
    genWindowId = w.id;
    tabId = w.tabs && w.tabs[0] && w.tabs[0].id;
  }
  await waitForTabComplete(tabId);
  return tabId;
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

async function dispatch(jobId, prompt, aspect, referenceImages, pageTabId, engine) {
  const eng = ENGINE_URL[engine] ? engine : "chatgpt";
  const label = eng === "flow" ? "Flow" : "ChatGPT";
  const runMsg = { type: "tbbook-run", jobId, prompt, aspect, referenceImages: referenceImages || [] };

  // 잡마다 전용 창 안에 새 탭을 연다. 끝난 탭은 닫지 않아 결과를 확인할 수 있다.
  statusToPage(pageTabId, jobId, "progress", { message: label + " 창 여는 중…" });
  const fresh = await openFreshTab(ENGINE_URL[eng]);
  JOBS.set(jobId, { pageTabId, genTabId: fresh });
  await sendToTab(fresh, runMsg, 50);
}

// MV3 서비스워커에는 FileReader 가 없어 base64 를 직접 만든다.
function bytesToBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

// Flow 이미지는 content script fetch 로는 CORS 차단 → host_permissions 를 가진
// background 가 대신 fetch(쿠키 포함, CORS 우회)해 dataUrl 로 돌려준다.
async function fetchImageAsDataUrl(url) {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error("이미지 다운로드 실패 " + r.status);
  const blob = await r.blob();
  const buf = await blob.arrayBuffer();
  const mime = blob.type || "image/png";
  return "data:" + mime + ";base64," + bytesToBase64(new Uint8Array(buf));
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  // From the tbbook page (bridge.js)
  if (msg.type === "tbbook-generate") {
    const pageTabId = sender.tab && sender.tab.id;
    const jobId = msg.jobId;
    const label = msg.engine === "flow" ? "Flow" : "ChatGPT";
    const loginHint = msg.engine === "flow" ? "labs.google(구글) 로그인 후 다시 시도하세요." : "chatgpt.com 로그인 후 다시 시도하세요.";
    (async () => {
      try {
        statusToPage(pageTabId, jobId, "progress", { message: label + " 탭 준비 중…" });
        await dispatch(jobId, msg.prompt, msg.aspect, msg.referenceImages, pageTabId, msg.engine);
      } catch (e) {
        statusToPage(pageTabId, jobId, "error", { message: label + " 탭에 연결할 수 없어요 — " + loginHint + " (" + ((e && e.message) || e) + ")" });
        JOBS.delete(jobId);
      }
    })();
    return;
  }

  if (msg.type === "tbbook-cancel") {
    const job = JOBS.get(msg.jobId);
    if (job) chrome.tabs.sendMessage(job.genTabId, { type: "tbbook-cancel", jobId: msg.jobId }).catch(() => {});
    return;
  }

  // From the Flow tab (flow.js): fetch the finished image with cookies, CORS-free.
  if (msg.type === "tbbook-fetch-image") {
    (async () => {
      try {
        sendResponse({ ok: true, dataUrl: await fetchImageAsDataUrl(msg.url) });
      } catch (e) {
        sendResponse({ ok: false, error: (e && e.message) || String(e) });
      }
    })();
    return true; // async sendResponse
  }

  // From the generation tab (chatgpt.js / flow.js)
  if (msg.type === "tbbook-status") {
    const job = JOBS.get(msg.jobId);
    if (!job) return;
    if (msg.status === "need-login" && job.genTabId != null) {
      chrome.tabs.update(job.genTabId, { active: true }).catch(() => {});
    }
    statusToPage(job.pageTabId, msg.jobId, msg.status, { message: msg.message, dataUrl: msg.dataUrl });
    if (msg.status === "done" || msg.status === "error") JOBS.delete(msg.jobId);
    return;
  }
});
