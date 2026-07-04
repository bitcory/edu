// Content script on labs.google (Google Flow), ISOLATED world.
// chatgpt.js 와 같은 규약: background 로부터 { type: "tbbook-run", jobId, prompt,
// aspect, referenceImages } 를 받아 실행하고 "tbbook-status" 로 진행/결과를 보고한다.
// 실제 DOM 자동화(React onClick 우회 등)는 MAIN world 의 flow-main.js 가 맡고,
// 여기서는 window.postMessage 로 다리만 놓는다.
//
// 완성된 이미지 URL 은 labs.google API → flow-content.google 로 리다이렉트되고
// ACAO:* 라 content script fetch(credentials)로는 CORS 차단됨. host_permissions
// 를 가진 background 가 대신 fetch(쿠키 포함)해 dataUrl 로 돌려준다.
(() => {
  const log = (m) => console.log("[TBBOOK-FLOW]", m);
  const TAG = "__TBBOOK_FLOW__";
  const status = (jobId, st, extra = {}) => { try { chrome.runtime.sendMessage({ type: "tbbook-status", jobId, status: st, ...extra }); } catch { /* ignore */ } };

  // MAIN world(flow-main.js)에 생성을 요청하고 결과 이미지 URL 을 받는다.
  function runViaMain(jobId, job, report) {
    return new Promise((resolve, reject) => {
      const onMsg = (e) => {
        if (e.source !== window) return;
        const d = e.data;
        if (!d || d.tag !== TAG || d.id !== jobId) return;
        if (d.dir === "progress") { report(d.message); return; }
        if (d.dir === "done") { cleanup(); resolve(d.url); return; }
        if (d.dir === "error") { cleanup(); reject(new Error(d.message || "Flow 생성 실패")); return; }
      };
      const cleanup = () => window.removeEventListener("message", onMsg);
      window.addEventListener("message", onMsg);
      window.postMessage({ tag: TAG, dir: "req", action: "generate", id: jobId, job }, "*");
    });
  }

  async function runImageJob(jobId, prompt, aspect, referenceImages, referenceNames) {
    const report = (m) => { log(m); status(jobId, "progress", { message: m }); };
    try {
      report("Flow 준비 중…");
      const url = await runViaMain(jobId, {
        id: jobId,
        prompt: prompt || "",
        aspect: aspect || "16:9",
        referenceImages: Array.isArray(referenceImages) ? referenceImages.filter(Boolean) : [],
        referenceNames: Array.isArray(referenceNames) ? referenceNames : [],
      }, report);

      report("이미지 가져오는 중…");
      const r = await new Promise((resolve) => {
        try { chrome.runtime.sendMessage({ type: "tbbook-fetch-image", url }, (res) => resolve(res)); }
        catch { resolve(null); }
      });
      if (!r || !r.ok || !r.dataUrl) throw new Error((r && r.error) || "이미지 다운로드 실패");
      status(jobId, "done", { dataUrl: r.dataUrl });
      log("완료");
    } catch (e) {
      status(jobId, "error", { message: (e && e.message) || String(e) });
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "tbbook-run") { runImageJob(msg.jobId, msg.prompt, msg.aspect, msg.referenceImages, msg.referenceNames); }
    else if (msg.type === "tbbook-cancel") { window.postMessage({ tag: TAG, dir: "req", action: "cancel", id: msg.jobId }, "*"); }
    else if (msg.type === "tbbook-ping") { sendResponse({ ok: true }); return true; }
  });

  log("TB Magic Book 이미지 도우미 준비됨 (Flow)");
})();
