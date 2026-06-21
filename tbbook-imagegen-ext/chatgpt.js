// Content script on chatgpt.com. Drives the ChatGPT image tool on demand:
// receives { type: "tbbook-run", jobId, prompt, aspect } from the background,
// automates the page, and reports progress/result via "tbbook-status" messages.
//
// The DOM-automation core (selectors, image-mode activation, aspect ratio,
// prompt typing, result scraping) is reused from ai-video-studio's automate.js.
(() => {
  const log = (m) => console.log("[TBBOOK-GEN]", m);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  const SEL = {
    promptInput: "#prompt-textarea",
    promptFallback: 'div.ProseMirror[contenteditable="true"][role="textbox"]',
    plus: "#composer-plus-btn",
    plusFallback: 'button[data-testid="composer-plus-btn"]',
    send: 'button[data-testid="send-button"]',
    stop: 'button[data-testid="stop-button"]',
    turn: '[data-testid^="conversation-turn-"]',
  };
  const PAT = {
    imageTool: ["이미지 만들기", "Create image", "Create an image"],
    moreSubmenu: ["더 보기", "More"],
    genAlt: ["생성된 이미지", "Generated image"],
    editAlt: ["편집된 이미지", "Edited image"],
  };
  const SIZE_MAP = {
    "1:1": { ratio: "1:1", labels: ["정사각형 1:1", "Square 1:1"] },
    "3:4": { ratio: "3:4", labels: ["세로 3:4", "Portrait 3:4"] },
    "4:3": { ratio: "4:3", labels: ["가로 4:3", "Landscape 4:3"] },
    "16:9": { ratio: "16:9", labels: ["와이드스크린 16:9", "Widescreen 16:9"] },
    "9:16": { ratio: "9:16", labels: ["스토리 9:16", "Story 9:16"] },
  };

  const getPromptInput = () => qs(SEL.promptInput) || qs(SEL.promptFallback);
  const getPlusButton = () => qs(SEL.plus) || qs(SEL.plusFallback);
  const getSendButton = () => qs(SEL.send);
  const isStreaming = () => !!qs(SEL.stop);

  async function clickEl(el) {
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0, pointerType: "mouse", pointerId: 1, isPrimary: true };
    el.dispatchEvent(new PointerEvent("pointerdown", o));
    el.dispatchEvent(new PointerEvent("pointerup", o));
    el.click();
    await sleep(60);
  }
  const findByText = (sel, pats) => qsa(sel).find((e) => { const t = (e.innerText || e.textContent || "").trim(); return pats.some((p) => t === p || t.startsWith(p)); });

  function getPlaceholder() {
    const i = getPromptInput();
    if (!i) return "";
    const inner = qs("[data-placeholder]", i);
    return i.getAttribute("data-placeholder") || i.getAttribute("placeholder") || (inner && inner.getAttribute("data-placeholder")) || "";
  }
  function isImageModeActive() {
    const ph = getPlaceholder();
    if (ph.includes("이미지 묘사 또는 편집") || ph.toLowerCase().includes("describe or edit")) return true;
    const form = qs("form");
    if (form) {
      const chip = qsa("button", form).find((b) => { const a = b.getAttribute("aria-label") || ""; return a.startsWith("이미지") || a.startsWith("Image"); });
      if (chip) return true;
    }
    return false;
  }
  async function openPlusMenu() {
    const btn = getPlusButton();
    if (!btn) return false;
    if (btn.getAttribute("aria-expanded") === "true") return true;
    await clickEl(btn);
    for (let i = 0; i < 15; i++) { await sleep(100); if (qs('[role="menu"]')) return true; }
    return !!qs('[role="menu"]');
  }
  async function activateImageTool() {
    if (isImageModeActive()) return true;
    const quick = findByText('button, [role="button"], a', PAT.imageTool);
    if (quick) {
      await clickEl(quick);
      for (let i = 0; i < 6; i++) { await sleep(250); if (isImageModeActive()) return true; }
    }
    if (await openPlusMenu()) {
      const item = qsa('[role="menuitemradio"], [role="menuitem"]').find((e) => { const t = (e.innerText || "").trim(); return PAT.imageTool.some((p) => t === p || t.startsWith(p)); });
      if (item) {
        await clickEl(item);
        for (let i = 0; i < 6; i++) { await sleep(250); if (isImageModeActive()) return true; }
      }
      const more = findByText('[role="menuitem"]', PAT.moreSubmenu);
      if (more) {
        await clickEl(more);
        await sleep(400);
        const sub = qsa('[role="menuitemradio"], [role="menuitem"]').find((e) => { const t = (e.innerText || "").trim(); return PAT.imageTool.some((p) => t === p || t.startsWith(p)); });
        if (sub) {
          await clickEl(sub);
          for (let i = 0; i < 6; i++) { await sleep(250); if (isImageModeActive()) return true; }
        }
      }
    }
    return isImageModeActive();
  }

  function findSizeBtn() {
    const form = qs("form"); if (!form) return null;
    const cands = ["자동", "Auto", "1:1", "3:4", "4:3", "9:16", "16:9"];
    return qsa("button", form).find((b) => { const t = (b.innerText || "").trim(); return cands.some((c) => t === c || t.startsWith(c)); }) || null;
  }
  const isSizeMenuOpen = () => { const m = qs('[role="menu"]'); return !!m && m.querySelectorAll('[role="menuitemradio"]').length > 0; };
  async function applyImageSize(ASPECT) {
    const map = SIZE_MAP[ASPECT]; if (!map) return false;
    const btn = findSizeBtn(); if (!btn) return false;
    if ((btn.innerText || "").trim().includes(map.ratio)) return true;
    await clickEl(btn);
    for (let i = 0; i < 15; i++) { await sleep(100); if (isSizeMenuOpen()) break; }
    if (!isSizeMenuOpen()) return false;
    const target = qsa('[role="menuitemradio"]').find((it) => { const t = (it.innerText || "").trim(); return map.labels.some((l) => t === l || t.includes(l)) || t.includes(map.ratio); });
    if (!target) { document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return false; }
    await clickEl(target);
    for (let i = 0; i < 10; i++) { await sleep(100); const f = findSizeBtn(); if (f && (f.innerText || "").trim().includes(map.ratio)) return true; }
    return false;
  }

  function hasContent(el, text) { return (el.textContent || "").includes(text.slice(0, Math.min(20, text.length))); }
  function fireInput(el, text) {
    el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: text }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, key: "Unidentified" }));
  }
  async function ensureSendAppears(el, text, ms) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const b = getSendButton(); if (b && !b.disabled) return true; fireInput(el, text); await sleep(150); }
    return false;
  }
  function clearInput(el) { try { const sel = window.getSelection(); sel.removeAllRanges(); const r = document.createRange(); r.selectNodeContents(el); sel.addRange(r); document.execCommand("delete", false); } catch { /* ignore */ } }
  async function typePrompt(text) {
    const el = getPromptInput(); if (!el) return false;
    el.focus(); await sleep(50);
    clearInput(el); await sleep(50);
    document.execCommand("insertText", false, text);
    fireInput(el, text);
    await sleep(200);
    if (!hasContent(el, text)) {
      clearInput(el);
      const dt = new DataTransfer(); dt.setData("text/plain", text);
      el.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt }));
      await sleep(200); fireInput(el, text);
    }
    if (!hasContent(el, text)) return false;
    return await ensureSendAppears(el, text, 8000);
  }

  function lastTurnImageUrls() {
    const turns = qsa(SEL.turn); const last = turns[turns.length - 1]; if (!last) return [];
    const out = []; const seen = new Set();
    qsa("img", last).forEach((im) => {
      const alt = im.alt || "";
      const isGen = PAT.genAlt.some((p) => alt.startsWith(p)) || PAT.editAlt.some((p) => alt.startsWith(p));
      if (!isGen) return;
      const s = im.src || ""; if (!s || s.startsWith("blob:") || s.startsWith("data:")) return;
      const clean = s.split("#")[0]; if (seen.has(clean)) return; seen.add(clean); out.push(clean);
    });
    return out;
  }
  function blobToDataUrl(blob) { return new Promise((rs, rj) => { const fr = new FileReader(); fr.onloadend = () => rs(fr.result); fr.onerror = rj; fr.readAsDataURL(blob); }); }

  async function isLoggedIn() {
    try {
      const r = await fetch("https://chatgpt.com/api/auth/session", { credentials: "include" });
      if (!r.ok) return false;
      const j = await r.json().catch(() => null);
      return !!(j && (j.user || j.accessToken));
    } catch { return false; }
  }

  const RATE_PAT = ["한도", "제한에 도달", "사용량", "잠시 후 다시", "나중에 다시", "rate limit", "too many", "limit reached", "try again later", "usage limit", "you've hit"];
  function isRateLimited() {
    const turns = qsa(SEL.turn); const last = turns[turns.length - 1];
    const t = (last ? (last.innerText || last.textContent || "") : "").toLowerCase();
    return !!t && RATE_PAT.some((p) => t.includes(p.toLowerCase()));
  }

  // ── job handling ──────────────────────────────────────────────────────────
  const canceled = new Set();
  const status = (jobId, st, extra = {}) => { try { chrome.runtime.sendMessage({ type: "tbbook-status", jobId, status: st, ...extra }); } catch { /* ignore */ } };

  async function runImageJob(jobId, prompt, aspect) {
    const report = (m) => { log(m); status(jobId, "progress", { message: m }); };
    const ckCancel = () => { if (canceled.has(jobId)) throw new Error("정지됨 (사용자 취소)"); };
    try {
      report("로그인 확인 중…");
      if (!(await isLoggedIn())) { status(jobId, "need-login", { message: "ChatGPT 로그인 필요 — 열린 탭에서 로그인 후 다시 시도하세요" }); return; }

      report("ChatGPT 준비 중…");
      for (let i = 0; i < 40 && !getPromptInput(); i++) await sleep(300);
      if (!getPromptInput()) throw new Error("입력창 없음 — 페이지가 준비되지 않았습니다 (새로고침 후 재시도)");

      report("이미지 모드 활성화…");
      if (!(await activateImageTool())) log("경고: 이미지 모드 활성 실패 — 일반 모드로 진행");
      await applyImageSize(aspect || "16:9");

      report("프롬프트 입력 중…");
      ckCancel();
      if (!(await typePrompt(prompt || ""))) throw new Error("프롬프트 입력 실패 (전송버튼 미활성)");

      let sendBtn = getSendButton(), t = 0;
      while ((!sendBtn || sendBtn.disabled) && t++ < 30) { await sleep(150); sendBtn = getSendButton(); }
      if (!sendBtn || sendBtn.disabled) throw new Error("전송 버튼 비활성");
      await clickEl(sendBtn);
      report("전송됨 · 이미지 생성 대기 중…");
      await sleep(500);

      let stableUrl = null, stableCount = 0;
      for (let i = 0; i < 160; i++) {
        await sleep(1500);
        if (i % 4 === 0) ckCancel();
        if (isRateLimited()) throw new Error("ChatGPT 사용량 한도(레이트 리밋)에 도달했어요");
        if (i > 0 && i % 8 === 0) report("이미지 생성 대기 중… (" + Math.round(i * 1.5) + "초)");
        const urls = lastTurnImageUrls();
        const u = urls.length ? urls[urls.length - 1] : null;
        if (u) {
          if (u === stableUrl) stableCount++;
          else { stableUrl = u; stableCount = 0; }
          if (isStreaming() ? stableCount >= 4 : stableCount >= 1) break;
        } else if (!isStreaming()) {
          stableCount = 0;
        }
      }
      if (!stableUrl) throw new Error("시간 초과 — 생성된 이미지를 찾지 못했어요");

      report("이미지 가져오는 중…");
      const res = await fetch(stableUrl, { credentials: "include" });
      if (!res.ok) throw new Error("이미지 다운로드 실패 " + res.status);
      const dataUrl = await blobToDataUrl(await res.blob());
      status(jobId, "done", { dataUrl });
      log("완료");
    } catch (e) {
      status(jobId, "error", { message: (e && e.message) || String(e) });
    } finally {
      canceled.delete(jobId);
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "tbbook-run") { runImageJob(msg.jobId, msg.prompt, msg.aspect); }
    else if (msg.type === "tbbook-cancel") { canceled.add(msg.jobId); }
    else if (msg.type === "tbbook-ping") { sendResponse({ ok: true }); return true; }
  });

  log("TB Magic Book 이미지 도우미 준비됨 (ChatGPT)");
})();
