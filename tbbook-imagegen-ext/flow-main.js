// TB Magic Book — Google Flow 자동화 (MAIN world).
// Flow 의 생성 버튼은 합성클릭(isTrusted)을 막아 React onClick 직접 호출이 필요한데,
// 그건 MAIN world 에서만 페이지 React props 에 접근 가능하다. 그래서 DOM 자동화는 여기서,
// chrome.runtime(확장 통신)은 ISOLATED 의 flow.js 가 맡고 window.postMessage 로 다리를 놓는다.
//
// 동작 모델 (TOOLB FLOW page-script.js v1.6.8 의 검증된 방식을 이식):
//   - 탭 하나 = 프로젝트 하나. 모든 작업(컷)이 이 탭의 큐로 들어와 순차 처리된다.
//   - 참조(캐릭터) 이미지는 이름으로 라이브러리에 1회만 업로드하고, 이후 컷마다
//     등장 캐릭터만 골라 + 피커("프롬프트에 추가")로 재첨부한다 (인물매칭).
//   - 30%/80% 파이프라인: 앞 이미지가 30% 되면 다음 컷 프롬프트 준비(첨부+타이핑)
//     시작, 80% 되면 Generate 클릭. 타이핑 시간이 생성 시간 뒤에 숨어 체감속도 상승.
//   - 완료 감시는 data-tile-id 단위 워처가 담당 (안정화 2초 후 src 확정, 부분 구제).
;(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a))
  const qs = (s, r = document) => r.querySelector(s)
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s))

  // 확장 재로드 시 구 인스턴스 리스너가 남아 중복 실행되는 문제 방지 (TOOLB v1.4.9)
  const MY_TOKEN = 'tbbook-flow-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now()
  window.__tbbookFlowToken = MY_TOKEN

  const PROMPT_SELECTORS = [
    '[role="textbox"][contenteditable="true"]',
    '[data-slate-editor="true"][contenteditable="true"]',
    '[role="textbox"]',
    'textarea'
  ]
  function findEditor() {
    for (const s of PROMPT_SELECTORS) { const el = qs(s); if (el) return el }
    return null
  }
  function isVisible(el) {
    if (!el) return false
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return false
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') return false
    return !el.disabled // offsetParent 는 position:fixed 요소에서 null 이라 판단에 쓰지 않음
  }

  // Flow send 버튼: arrow_forward+만들기 정확 매칭 → arrow_forward 단독(하단 우선)
  // → aria-label/텍스트 키워드 순. disabled/비가시 스킵. (TOOLB v1.6.1)
  function findGenerateBtn() {
    const keys = ['send', 'submit', 'generate', '만들기', '전송', '보내기']
    const arrows = []
    const labels = []
    for (const b of qsa('button')) {
      if (b.disabled || b.getAttribute('aria-disabled') === 'true' || !isVisible(b)) continue
      const icon = b.querySelector('i')
      const iconText = icon ? (icon.textContent || '').trim() : ''
      const btnText = (b.textContent || '').trim()
      const label = ((b.getAttribute('aria-label') || '') + ' ' + btnText).toLowerCase()
      if (iconText === 'arrow_forward' && btnText.indexOf('만들기') !== -1) return b
      if (iconText === 'arrow_forward') { arrows.push(b); continue }
      for (const k of keys) { if (label.indexOf(k) !== -1) { labels.push(b); break } }
    }
    if (arrows.length) return arrows[arrows.length - 1]
    if (labels.length) return labels[labels.length - 1]
    return null
  }

  // Flow 는 isTrusted 검사로 합성클릭을 무시 → React props.onClick 을 직접 호출(우회).
  function dispatchRealClick(el) {
    if (!el) return
    let rk = null
    for (const k of Object.keys(el)) { if (k.indexOf('__reactProps') === 0) { rk = k; break } }
    if (rk) {
      const props = el[rk]
      if (props && typeof props.onClick === 'function') {
        const fake = {
          type: 'click', target: el, currentTarget: el, bubbles: true, cancelable: true,
          isTrusted: true, defaultPrevented: false, preventDefault() { this.defaultPrevented = true },
          stopPropagation() {}, stopImmediatePropagation() {},
          nativeEvent: { isTrusted: true, type: 'click' }, button: 0, buttons: 0
        }
        try { props.onClick(fake); return } catch (_) {}
      }
    }
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const common = { bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 1, clientX: cx, clientY: cy }
    try { el.dispatchEvent(new PointerEvent('pointerdown', Object.assign({ pointerType: 'mouse' }, common))) } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mousedown', common)) } catch (_) {}
    try { el.dispatchEvent(new PointerEvent('pointerup', Object.assign({ pointerType: 'mouse', buttons: 0 }, common))) } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mouseup', Object.assign({}, common, { buttons: 0 }))) } catch (_) {}
    try { el.click() } catch (_) {}
  }

  async function clearEditor() {
    const el = findEditor()
    if (!el) return false
    el.focus(); try { el.click() } catch (_) {}
    await sleep(rand(200, 400))
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', keyCode: 65, which: 65, ctrlKey: true, bubbles: true, cancelable: true }))
    await sleep(150)
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', keyCode: 65, which: 65, ctrlKey: true, bubbles: true }))
    await sleep(rand(100, 250))
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8, bubbles: true, cancelable: true }))
    await sleep(150)
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8, bubbles: true }))
    await sleep(rand(200, 400))
    if ((el.textContent || '').trim().length > 0) {
      try { el.focus(); const sel = window.getSelection(); sel.removeAllRanges(); sel.selectAllChildren(el); await sleep(40); document.execCommand('delete', false, null); await sleep(100) } catch (_) {}
    }
    return true
  }

  async function typeSlateChars(el, text) {
    el.focus(); try { el.click() } catch (_) {}
    await sleep(rand(150, 300))
    for (let i = 0; i < text.length; i++) {
      const ch = text.charAt(i)
      const kc = ch.charCodeAt(0)
      const code = /^[a-zA-Z]$/.test(ch) ? 'Key' + ch.toUpperCase() : /^[0-9]$/.test(ch) ? 'Digit' + ch : ''
      el.dispatchEvent(new KeyboardEvent('keydown', { key: ch, code, keyCode: kc, which: kc, bubbles: true, cancelable: true }))
      el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: ch, bubbles: true, cancelable: true, composed: true }))
      el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: ch, bubbles: true, composed: true }))
      el.dispatchEvent(new KeyboardEvent('keyup', { key: ch, code, keyCode: kc, which: kc, bubbles: true }))
      await sleep(10 + Math.floor(Math.random() * 15))
    }
    await sleep(rand(200, 500))
  }

  async function setPromptText(text) {
    const el = findEditor()
    if (!el) throw new Error('프롬프트 입력칸을 찾을 수 없습니다')
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const proto = el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value') && Object.getOwnPropertyDescriptor(proto, 'value').set
      if (setter) setter.call(el, text); else el.value = text
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }
    await typeSlateChars(el, text)
    const probe = text.substring(0, Math.min(20, text.length))
    if ((el.textContent || '').indexOf(probe) === -1) {
      try { el.focus(); const sel = window.getSelection(); sel.removeAllRanges(); sel.selectAllChildren(el); await sleep(40) } catch (_) {}
      el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, composed: true, inputType: 'insertText', data: text }))
      await sleep(120)
      if ((el.textContent || '').indexOf(probe) === -1) {
        el.focus()
        try { document.execCommand('selectAll', false, null) } catch (_) {}
        await sleep(30)
        try { document.execCommand('insertText', false, text) } catch (_) {}
        await sleep(100)
      }
    }
    return true
  }

  // 첫 클릭 후 5초 내 stop 아이콘/새 타일 미등장이면 cool-down 무시로 보고 1회 재클릭.
  // (TOOLB v1.6.7 — 직전 생성 종료 직후 send 가 조용히 무시되는 케이스)
  async function clickGenerate(isCanceled) {
    let btn = null
    const deadline = Date.now() + 90000
    while (Date.now() < deadline) {
      if (isCanceled()) throw new Error('취소됨')
      btn = findGenerateBtn()
      if (btn) break
      await sleep(300)
    }
    if (!btn) throw new Error('생성 버튼을 찾을 수 없습니다 (90초 대기)')

    const beforeTiles = getCurrentTileIds().size
    dispatchRealClick(btn)
    const verifyDeadline = Date.now() + 5000
    let accepted = false
    while (Date.now() < verifyDeadline) {
      await sleep(250)
      const stopBtn = qsa('button').find((b) => { const i = b.querySelector('i'); return i && (i.textContent || '').trim() === 'stop' && isVisible(b) })
      if (stopBtn) { accepted = true; break }
      if (getCurrentTileIds().size > beforeTiles) { accepted = true; break }
    }
    if (!accepted) {
      const btn2 = findGenerateBtn()
      if (btn2) dispatchRealClick(btn2)
    }
    return true
  }

  // ── 타일(생성 결과) 추적 ───────────────────────────────────────────────
  function getCurrentTileIds() {
    const ids = new Set()
    qsa('div[data-tile-id]').forEach((d) => ids.add(d.dataset.tileId))
    return ids
  }
  function getTileInfo(tileId) {
    const divs = qsa('div[data-tile-id="' + tileId + '"]')
    const pick = (d) => {
      const img = d.querySelector('img')
      const m = (d.textContent || '').match(/(\d{1,3})%/)
      const hasImg = !!(img && img.src && img.src.indexOf('labs.google') !== -1)
      return { found: true, hasImg, imgSrc: hasImg ? img.src : null, pct: m ? parseInt(m[1], 10) : -1 }
    }
    for (const d of divs) { if (d.children.length <= 1) return pick(d) }
    if (divs.length) return pick(divs[0])
    return { found: false }
  }

  // ── 프로젝트 진입 + 에이전트 모드 OFF ──────────────────────────────────
  function findNewProjectEl() {
    const cands = qsa('button,a,[role="button"],div,span,p').filter((e) => {
      const t = (e.textContent || '').replace(/\s+/g, ' ').trim()
      return t.indexOf('새 프로젝트') !== -1 && t.length < 16 && isVisible(e)
    })
    if (!cands.length) return null
    return cands[0].closest('button,a,[role="button"]') || cands[0]
  }
  function inFlowProject() { return location.href.indexOf('/project/') !== -1 }
  function fullPointerSeq(el) {
    const r = el.getBoundingClientRect()
    const o = { bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, isPrimary: true }
    const ev = (Ctor, type, extra) => { try { el.dispatchEvent(new Ctor(type, Object.assign({}, o, extra))) } catch (_) {} }
    ev(PointerEvent, 'pointerover', { pointerType: 'mouse' }); ev(MouseEvent, 'mouseover')
    ev(PointerEvent, 'pointerdown', { pointerType: 'mouse' }); ev(MouseEvent, 'mousedown')
    ev(PointerEvent, 'pointerup', { pointerType: 'mouse', buttons: 0 }); ev(MouseEvent, 'mouseup', { buttons: 0 })
    ev(MouseEvent, 'click', { buttons: 0 })
  }
  async function clickNewProject(isCanceled) {
    const tryStrat = async (fn) => {
      const el = findNewProjectEl()
      if (!el) { await sleep(500); return false }
      try { fn(el) } catch (_) {}
      const dl = Date.now() + 4000
      while (Date.now() < dl && !inFlowProject()) { if (isCanceled()) throw new Error('취소됨'); await sleep(300) }
      return inFlowProject()
    }
    if (await tryStrat((el) => el.click())) return true
    if (await tryStrat((el) => fullPointerSeq(el))) return true
    if (await tryStrat((el) => { const ov = el.querySelector('[data-type="button-overlay"]') || el; ov.click(); fullPointerSeq(ov) })) return true
    if (await tryStrat((el) => dispatchRealClick(el))) return true
    return inFlowProject()
  }

  // 콘텐츠 있는 프로젝트 진입 시 우측 에이전트 사이드패널이 열려 있으면 X 로 닫는다. (TOOLB v1.6.6)
  async function closeAgentSidePanel() {
    const W = window.innerWidth
    let closeBtn = null
    qsa('button').forEach((b) => {
      const i = b.querySelector('i')
      if (!i || (i.textContent || '').trim() !== 'close' || !isVisible(b)) return
      const r = b.getBoundingClientRect()
      if (r.x < W * 0.65 || r.y > 200) return
      closeBtn = b
    })
    if (!closeBtn) return false
    dispatchRealClick(closeBtn)
    await sleep(300)
    return true
  }

  // "에이전트" 토글(aria-pressed) 을 찾아 켜져 있으면 OFF. (TOOLB v1.6.6/1.6.8)
  // 에이전트 모드에선 결과가 메인 그리드(data-tile-id)가 아닌 채팅 응답에 떠 워처가
  // 완료를 못 잡으므로 반드시 꺼야 한다.
  async function ensureAgentModeOff() {
    function findToggle() {
      const btns = qsa('button')
      for (const b of btns) {
        if (!isVisible(b)) continue
        const t = (b.textContent || '').replace(/\s+/g, ' ').trim()
        if ((t === '에이전트' || t === 'Agent' || t === 'Agentic') && b.hasAttribute('aria-pressed')) return b
      }
      for (const b of btns) {
        if (!isVisible(b)) continue
        const t = (b.textContent || '').replace(/\s+/g, ' ').trim()
        if (t.length > 20) continue
        if ((t.indexOf('에이전트') !== -1 || t.toLowerCase().indexOf('agent') !== -1) && b.hasAttribute('aria-pressed')) return b
      }
      return null
    }
    let btn = null
    const findDl = Date.now() + 8000
    while (Date.now() < findDl) { btn = findToggle(); if (btn) break; await sleep(300) }
    if (!btn) return { ok: false, reason: 'no-toggle' }
    if (btn.getAttribute('aria-pressed') !== 'true') return { ok: true, alreadyOff: true }
    dispatchRealClick(btn)
    const dl = Date.now() + 1500
    while (Date.now() < dl) {
      await sleep(80)
      if (btn.getAttribute('aria-pressed') !== 'true') return { ok: true, toggled: true }
    }
    return { ok: false, reason: 'toggle-failed' }
  }

  async function prepareProject(isCanceled, report) {
    if (!inFlowProject()) {
      report('새 프로젝트 진입…')
      const entered = await clickNewProject(isCanceled)
      if (!entered) report('경고: 새 프로젝트 진입 실패 — Flow 화면에서 프로젝트를 직접 열어주세요')
      const dl2 = Date.now() + 12000
      while (Date.now() < dl2 && !findEditor()) { if (isCanceled()) throw new Error('취소됨'); await sleep(300) }
      await sleep(800)
    }
    try { if (await closeAgentSidePanel()) report('에이전트 사이드패널 닫음') } catch (_) {}
    report('에이전트 모드 확인…')
    const res = await ensureAgentModeOff()
    if (res.toggled) report('에이전트 모드 껐음')
    else if (res.alreadyOff) report('에이전트 모드 이미 꺼짐')
    else report('에이전트 토글 못 찾음 — 켜져 있으면 수동으로 꺼주세요')
  }

  // ── 화면비율/장수 설정 + 참조이미지(i2i) 업로드/첨부 ───────────────────
  const ASPECT_ICON = { '16:9': 'crop_16_9', '9:16': 'crop_9_16', '1:1': 'crop_square', '4:3': 'crop_landscape', '3:4': 'crop_portrait' }
  function findBtnByIcon(iconText) {
    return qsa('button').find((b) => { const i = b.querySelector('i'); return i && (i.textContent || '').trim() === iconText && isVisible(b) }) || null
  }
  function findBtnByText(text, exact) {
    return qsa('button').find((b) => { const t = (b.textContent || '').trim(); return isVisible(b) && (exact === false ? t.indexOf(text) === 0 : t === text) }) || null
  }
  const nfc = (s) => { try { return String(s).normalize('NFC') } catch (_) { return String(s) } }
  const sanitizeName = (s) => nfc(s).replace(/[\\/:*?"<>|#@\[\]]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 40)
  async function base64ToFile(dataUrl, fileName) {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    return new File([blob], fileName, { type: blob.type })
  }
  function findFileInput() {
    const inputs = qsa('input[type="file"]')
    for (const inp of inputs) { const acc = (inp.accept || '').toLowerCase(); if (acc.includes('image') || acc === '' || acc === '*/*') return inp }
    return inputs[0] || null
  }
  function findUploadTrigger() {
    const keywords = ['업로드', 'upload', '이미지', 'image', '추가', 'add', '에셋', 'asset', '첨부']
    for (const el of qsa('button, [role="button"], [aria-label]')) {
      if (el.offsetParent === null) continue
      const text = ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase()
      if (keywords.some((k) => text.indexOf(k) !== -1)) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.width < 200 && r.height < 100) return el
      }
    }
    return null
  }
  function findDropZone() {
    const sels = ['[class*="dropZone"]', '[class*="drop-zone"]', '[class*="DropZone"]', '[class*="upload-area"]', '[class*="uploadArea"]', '[class*="Dropzone"]', '[data-dropzone]', '[aria-label*="drop" i]', '[aria-label*="upload" i]']
    for (const s of sels) { const el = qs(s); if (el && el.offsetParent !== null) return el }
    return null
  }
  async function simulateDrop(target, file) {
    const dt = new DataTransfer(); dt.items.add(file)
    target.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt })); await sleep(60)
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); await sleep(60)
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
  }
  function injectIntoFileInput(fileInput, file) {
    const dt = new DataTransfer(); dt.items.add(file)
    try { Object.defineProperty(fileInput, 'files', { value: dt.files, configurable: true }) } catch (e) { fileInput.files = dt.files }
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    fileInput.dispatchEvent(new Event('input', { bubbles: true }))
  }
  async function waitForLibraryTileIncrease(baseline, maxMs) {
    const deadline = Date.now() + (maxMs || 30000)
    while (Date.now() < deadline) { const cur = qsa('[data-tile-id]').length; if (cur > baseline) return { ok: true, count: cur }; await sleep(400) }
    return { ok: false, count: qsa('[data-tile-id]').length }
  }
  // 진행중인 "생성" 타일의 % 텍스트와 혼동하지 않도록, 업로드 시작 전에 이미 있던
  // % 요소는 무시하고 새로 나타난 것만 추적한다. (한 프로젝트에서 생성과 업로드가
  // 동시에 돌아가는 파이프라인 구조라서 필요)
  async function waitForUploadProgressComplete(maxMs) {
    const deadline = Date.now() + (maxMs || 60000)
    const pctRe = /^\s*\d{1,3}\s*%\s*$/
    const preexisting = new Set(qsa('div, span').filter((el) => el.children.length === 0 && pctRe.test(el.textContent || '')))
    let seenAny = false
    const findPct = () => qsa('div, span').filter((el) => el.children.length === 0 && el.offsetParent !== null && pctRe.test(el.textContent || '') && !preexisting.has(el))
    while (Date.now() < deadline) {
      const els = findPct()
      if (els.length === 0) { if (seenAny) return true; await sleep(300); if (findPct().length === 0) return true; continue }
      seenAny = true
      if (els.every((e) => (e.textContent || '').trim() === '100%')) { await sleep(300); return true }
      await sleep(400)
    }
    return false
  }
  // dataURL → Flow 소재 라이브러리 업로드 (진행률·타일 증가 폴링).
  async function uploadImageToLibrary(dataUrl, name) {
    const file = await base64ToFile(dataUrl, name)
    const baseline = qsa('[data-tile-id]').length
    let fi = findFileInput()
    if (fi) injectIntoFileInput(fi, file)
    else {
      const trigger = findUploadTrigger()
      if (trigger) { trigger.click(); await sleep(700); fi = findFileInput(); if (fi) injectIntoFileInput(fi, file) }
      if (!fi) { const dz = findDropZone(); if (dz) await simulateDrop(dz, file); else await simulateDrop(document.body, file) }
    }
    await waitForUploadProgressComplete(60000)
    await waitForLibraryTileIncrease(baseline, 30000)
    await sleep(800)
  }
  // 이름으로 소재 피커에서 골라 프롬프트에 첨부 ("프롬프트에 추가" = 새 UI 필수 경로).
  // strict=true 면 정확/부분 일치만 허용 — "라이브러리에 있는지 확인" 용도로 쓸 때
  // 무관한 검색 결과를 잘못 집어 첨부하는 사고를 막는다.
  async function attachByName(name, strict) {
    let addBtn = null
    for (const b of qsa('button[aria-haspopup="dialog"]')) {
      if (!isVisible(b)) continue
      const ic = b.querySelector('i'); const t = ic ? (ic.textContent || '').trim() : ''
      if (t === 'add_2' || t === 'add' || t.indexOf('add') !== -1) { addBtn = b; break }
    }
    if (!addBtn) {
      for (const b of qsa('button')) {
        if (!isVisible(b)) continue
        const ic = b.querySelector('i')
        if (ic && (ic.textContent || '').trim() === 'add_2') { addBtn = b; break }
      }
    }
    if (!addBtn) throw new Error('"+" 버튼 없음')
    addBtn.click(); await sleep(700)
    const dlg = qs('[role="dialog"]')
    if (!dlg) throw new Error('애셋 다이얼로그 안 열림')
    const search = dlg.querySelector('input[placeholder*="애셋"]') || dlg.querySelector('input[placeholder*="검색"]') || dlg.querySelector('input[type="text"]') || dlg.querySelector('input')
    if (!search) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); throw new Error('검색창 없음') }
    search.focus()
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') && Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    if (setter) setter.call(search, name); else search.value = name
    search.dispatchEvent(new Event('input', { bubbles: true }))
    search.dispatchEvent(new Event('change', { bubbles: true }))
    await sleep(1200)
    const candidates = []
    dlg.querySelectorAll('div').forEach((d) => {
      if (!d.querySelector('img')) return
      const r = d.getBoundingClientRect()
      if (r.width < 100 || r.height < 30 || r.width > 500) return
      if (d.children.length > 6) return
      let nm = ''
      for (const le of d.querySelectorAll('div, span')) { if (le.children.length === 0) { const t = (le.textContent || '').trim(); if (t) { nm = t; break } } }
      if (!nm) nm = (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)
      candidates.push({ el: d, name: nfc(nm) })
    })
    const needle = nfc(name)
    let chosen = candidates.find((c) => c.name === needle) || candidates.find((c) => c.name.indexOf(needle) !== -1 || needle.indexOf(c.name) !== -1)
    if (!chosen && !strict && candidates.length && candidates.length <= 3) chosen = candidates[0]
    if (!chosen) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(300); throw new Error('검색 결과 없음: ' + name) }
    dispatchRealClick(chosen.el); await sleep(500)
    let addToPrompt = null
    const stillDlg = qs('[role="dialog"]')
    if (stillDlg) {
      for (const b of stillDlg.querySelectorAll('button')) {
        if (!isVisible(b)) continue
        const t = (b.textContent || '').trim()
        if (t === '프롬프트에 추가' || t === 'Add to prompt' || t.indexOf('프롬프트에 추가') !== -1) { addToPrompt = b; break }
      }
    }
    if (addToPrompt) {
      dispatchRealClick(addToPrompt)
      const dl = Date.now() + 2000
      while (Date.now() < dl) { await sleep(100); if (!qs('[role="dialog"]')) break }
    } else {
      await sleep(300)
      if (qs('[role="dialog"]')) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(300) }
    }
    return true
  }

  // 화면비율 + 장수 설정.
  //
  // 새 Flow UI (2026-07, 크롬 확장으로 실측 검증): 입력란 옆
  // "🍌 Nano Banana 2 · crop_16_9 · 1x" 칩(button[aria-haspopup="menu"], 아이콘이
  // crop_ 로 시작) 을 누르면 radix 팝업([data-radix-popper-content-wrapper])이 열리고,
  // 그 안의 button[role="tab"] 들이 이미지/동영상 · 비율(crop_16_9/crop_landscape/
  // crop_square/crop_portrait/crop_9_16) · 장수(1x~x4) 탭이다.
  //   - 탭은 native click 을 무시하고 pointer/mouse 풀 시퀀스에만 반응 (실측).
  //   - 선택 결과는 칩 아이콘에 즉시 반영되므로 그걸로 검증한다.
  //   - Escape 로 팝업을 닫는다.
  // 칩이 없으면 구 UI(tune 패널) 로 폴백.
  async function setAspectAndCount(aspect, report) {
    const icon = ASPECT_ICON[aspect] || 'crop_16_9'
    const findChip = () => qsa('button[aria-haspopup="menu"]').find((b) => {
      const i = b.querySelector('i')
      return i && (i.textContent || '').trim().indexOf('crop_') === 0 && isVisible(b)
    })
    const chip = findChip()
    if (chip) {
      const cur = (chip.querySelector('i').textContent || '').trim()
      if (cur === icon) return // 이미 원하는 비율
      report('화면비율 설정… (' + aspect + ')')
      fullPointerSeq(chip)
      let wrap = null
      const dl = Date.now() + 4000
      while (Date.now() < dl && !(wrap = qs('[data-radix-popper-content-wrapper]'))) await sleep(150)
      if (!wrap) { report('비율 팝업 안 열림 (계속 진행)'); return }
      const tabs = qsa('button[role="tab"]', wrap)
      const byIcon = (name) => tabs.find((b) => { const i = b.querySelector('i'); return i && (i.textContent || '').trim() === name })
      const imgTab = byIcon('image')
      if (imgTab && imgTab.getAttribute('data-state') !== 'active') { fullPointerSeq(imgTab); await sleep(400) }
      const aspTab = byIcon(icon)
      if (aspTab) { fullPointerSeq(aspTab); await sleep(400) }
      const oneTab = tabs.find((b) => (b.textContent || '').trim() === '1x')
      if (oneTab && oneTab.getAttribute('data-state') !== 'active') { fullPointerSeq(oneTab); await sleep(300) }
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await sleep(400)
      const chip2 = findChip()
      const ic2 = chip2 && chip2.querySelector('i')
      if (ic2 && (ic2.textContent || '').trim() === icon) report('화면비율 ' + aspect + ' 설정됨')
      else report('화면비율 변경 확인 실패 (계속 진행)')
      return
    }
    // 구 UI 폴백: tune 패널 → (매번확인 off) → 비율 → 1장 → 저장.
    const tunes = qsa('button').filter((b) => { const i = b.querySelector('i'); return i && (i.textContent || '').trim() === 'tune' && isVisible(b) })
    if (!tunes.length) return
    report('화면비율 설정… (' + aspect + ')')
    dispatchRealClick(tunes[tunes.length - 1])
    await sleep(1200)
    const body = document.body.innerText || ''
    if (body.indexOf('이미지 생성 기본값') === -1 && body.indexOf('에이전트 설정') === -1) return
    const nc = findBtnByIcon('radio_button_unchecked'); if (nc) { dispatchRealClick(nc); await sleep(300) }
    const asp = findBtnByIcon(icon); if (asp) { dispatchRealClick(asp); await sleep(300) }
    const one = findBtnByText('1x'); if (one) { dispatchRealClick(one); await sleep(300) }
    const save = findBtnByText('저장'); if (save) { dispatchRealClick(save); await sleep(1000) }
  }

  // ── 작업 큐 + 30%/80% 파이프라인 엔진 ─────────────────────────────────
  const TAG = '__TBBOOK_FLOW__'
  const MAX_SLOTS = 2            // 앞 이미지 생성 중에 다음 컷 1개까지 준비/전송
  const GEN_TIMEOUT_SEC = 240
  const STABILIZE_MS = 2000      // 완료 감지 후 src 프리뷰→최종 swap 대기

  const queue = []               // 대기 중인 job
  const activeGens = []          // 전송돼 생성 중인 슬롯
  let knownTileIds = new Set()
  let watcherRunning = false
  let pumpRunning = false
  let prepared = false
  const uploadedAssets = new Set() // 이 프로젝트 라이브러리에 업로드된 참조 이름
  const canceled = new Set()

  const post = (payload) => window.postMessage(Object.assign({ tag: TAG }, payload), '*')
  const progress = (id, message) => post({ dir: 'progress', id, message })
  const doneMsg = (id, url) => post({ dir: 'done', id, url })
  const failMsg = (id, message) => post({ dir: 'error', id, message })

  function createGen(job) {
    return {
      job,
      tileId: null,
      hadPct: false,
      firstCompleteAt: 0,
      imgSrc: null,
      requestTime: Date.now(),
      resolved: false,
      _lastBeat: 0
    }
  }

  function findNewTileId() {
    const current = getCurrentTileIds()
    const assigned = new Set(activeGens.map((g) => g.tileId).filter(Boolean))
    for (const id of current) { if (!knownTileIds.has(id) && !assigned.has(id)) return id }
    return null
  }

  function resolveGen(gen, url, errMsg) {
    gen.resolved = true
    if (gen.tileId) knownTileIds.add(gen.tileId)
    const i = activeGens.indexOf(gen)
    if (i !== -1) activeGens.splice(i, 1)
    if (canceled.has(gen.job.id)) { failMsg(gen.job.id, '취소됨'); canceled.delete(gen.job.id); return }
    if (url) doneMsg(gen.job.id, url)
    else failMsg(gen.job.id, errMsg || 'Flow 생성 실패')
  }

  // 완료 감시 워커 — 타일 1개(1x) 기준으로 단순화한 TOOLB NB2 워처.
  async function startWatcher() {
    if (watcherRunning) return
    watcherRunning = true
    while (watcherRunning) {
      for (let i = activeGens.length - 1; i >= 0; i--) {
        const gen = activeGens[i]
        if (gen.resolved) continue
        const elapsedSec = (Date.now() - gen.requestTime) / 1000

        if (!gen.tileId) {
          const nt = findNewTileId()
          if (nt) gen.tileId = nt
          else if (elapsedSec > GEN_TIMEOUT_SEC) { resolveGen(gen, null, '시간 초과 — 생성 타일 미감지'); continue }
          else {
            if (Date.now() - (gen._lastBeat || 0) > 5000) { gen._lastBeat = Date.now(); progress(gen.job.id, '생성 타일 대기 중…') }
            continue
          }
        }

        const info = getTileInfo(gen.tileId)
        if (info.found) {
          if (info.pct >= 0) {
            gen.hadPct = true
            if (gen.firstCompleteAt) { gen.firstCompleteAt = 0; gen.imgSrc = null } // 재생성 감지 → 리셋
          }
          if (info.hasImg && info.pct < 0) {
            if (!gen.firstCompleteAt) { gen.firstCompleteAt = Date.now(); gen.imgSrc = info.imgSrc }
            else {
              gen.imgSrc = info.imgSrc
              if (Date.now() - gen.firstCompleteAt >= STABILIZE_MS) { resolveGen(gen, gen.imgSrc); continue }
            }
          } else if (gen.hadPct && info.pct < 0 && !info.hasImg) {
            resolveGen(gen, null, '생성 실패 (타일이 이미지 없이 종료)')
            continue
          }
        }

        if (elapsedSec > GEN_TIMEOUT_SEC) {
          // 부분 구제: 타임아웃 시점에 이미지가 있으면 살린다
          const cur = getTileInfo(gen.tileId)
          resolveGen(gen, cur.found && cur.hasImg ? cur.imgSrc : null, '시간 초과 — 생성 이미지 없음')
          continue
        }

        // 5초 간격 진행 하트비트 (페이지 워치독 유지 + 사용자 표시)
        if (Date.now() - (gen._lastBeat || 0) > 5000) {
          gen._lastBeat = Date.now()
          const pctTxt = info.found && info.pct >= 0 ? info.pct + '%' : '처리 중'
          progress(gen.job.id, '이미지 생성 중… (' + pctTxt + ')')
        }
      }
      if (!activeGens.length && !queue.length) { watcherRunning = false; break }
      await sleep(1000)
    }
  }

  // 앞 슬롯이 targetPct 에 도달할 때까지 대기 (대기 중인 job 에 하트비트 전달).
  async function waitForGenProgress(gen, targetPct, waitingJobId) {
    const start = Date.now()
    let lastBeat = 0
    while (Date.now() - start < (GEN_TIMEOUT_SEC + 10) * 1000) {
      if (gen.resolved) return 'finished'
      if (canceled.has(waitingJobId)) return 'canceled'
      if (gen.tileId) {
        const info = getTileInfo(gen.tileId)
        if (info.found) {
          if (info.hasImg && info.pct < 0) return 'finished'
          if (info.pct >= targetPct) return 'reached'
        }
      }
      if (Date.now() - lastBeat > 7000) {
        lastBeat = Date.now()
        progress(waitingJobId, '앞 이미지 ' + targetPct + '% 도달 대기 중…')
      }
      await sleep(500)
    }
    return 'timeout'
  }

  // 문자열 djb2 해시 — 페이지가 referenceNames 를 안 보내는(구버전) 경우에도
  // dataURL 내용으로 항상 같은 이름을 만들어 중복 업로드를 막는다.
  function hashStr(s) {
    let h = 5381
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
    return (h >>> 0).toString(36)
  }

  // 참조 이미지: "첨부 먼저 → 검색 결과 없음일 때만 업로드".
  // 라이브러리 자체를 중복 체크로 쓰므로 탭을 새로 열거나 세션이 바뀌어도
  // 같은 이름(캐릭터명_해시)이 이미 있으면 절대 다시 올리지 않는다.
  async function ensureRefsAttached(job, report) {
    const refs = Array.isArray(job.referenceImages) ? job.referenceImages.filter(Boolean) : []
    if (!refs.length) return
    for (let i = 0; i < refs.length; i++) {
      if (canceled.has(job.id)) throw new Error('취소됨')
      const raw = (job.referenceNames && job.referenceNames[i]) || ('tbref_' + hashStr(refs[i]))
      const name = sanitizeName(raw) || ('tbref_' + hashStr(refs[i]))
      const label = '참조 ' + (i + 1) + '/' + refs.length + ' "' + name + '"'
      try {
        if (uploadedAssets.has(name)) {
          report(label + ' 첨부 중…')
          await attachByName(name)
        } else {
          // 이전 세션/탭에서 이미 올라가 있을 수 있으니 먼저 이름으로 첨부 시도(엄격 매칭)
          report(label + ' 라이브러리 확인·첨부 중…')
          try {
            await attachByName(name, true)
            uploadedAssets.add(name)
          } catch (_) {
            // 라이브러리에 없음 → 이번 한 번만 업로드 후 첨부
            report(label + ' 업로드 중…')
            await uploadImageToLibrary(refs[i], name)
            uploadedAssets.add(name)
            report(label + ' 첨부 중…')
            await attachByName(name)
          }
        }
      } catch (e) {
        report(label + ' 첨부 실패 (계속 진행): ' + ((e && e.message) || e))
      }
      await sleep(400)
    }
  }

  async function pump() {
    if (pumpRunning) return
    pumpRunning = true
    try {
      while (queue.length) {
        const job = queue[0]
        const isCanceled = () => canceled.has(job.id)
        if (isCanceled()) { queue.shift(); canceled.delete(job.id); failMsg(job.id, '취소됨'); continue }

        // (0) 프로젝트 준비 — 탭 수명 동안 1회
        if (!prepared) {
          try {
            progress(job.id, 'Flow 준비 중…')
            await prepareProject(isCanceled, (m) => progress(job.id, m))
            for (let i = 0; i < 40 && !findEditor(); i++) { if (isCanceled()) break; await sleep(300) }
            if (!findEditor()) throw new Error('입력칸 없음 — Flow 로그인/페이지 준비 확인')
            knownTileIds = getCurrentTileIds()
            prepared = true
          } catch (e) {
            queue.shift()
            canceled.delete(job.id)
            failMsg(job.id, (e && e.message) || String(e))
            continue
          }
        }

        // (1) 슬롯 대기
        let lastBeat = 0
        while (activeGens.length >= MAX_SLOTS && !isCanceled()) {
          if (Date.now() - lastBeat > 7000) { lastBeat = Date.now(); progress(job.id, '앞 작업 ' + activeGens.length + '개 생성 중 — 슬롯 대기…') }
          await sleep(500)
        }
        if (isCanceled()) { queue.shift(); canceled.delete(job.id); failMsg(job.id, '취소됨'); continue }

        // (2) 체크포인트 1 — 앞 이미지 30% 에서 다음 컷 준비 시작
        if (activeGens.length > 0) {
          const last = activeGens[activeGens.length - 1]
          if (!last.resolved) await waitForGenProgress(last, 30, job.id)
        }
        if (isCanceled()) { queue.shift(); canceled.delete(job.id); failMsg(job.id, '취소됨'); continue }

        queue.shift()
        try {
          // (3) 화면비율 — 매 작업마다 확인 (칩 아이콘이 이미 맞으면 즉시 리턴하는
          // 멱등 함수라서, 컷 16:9 → 표지 3:4 전환이나 수동 변경도 자동 복구된다)
          if (job.aspect) await setAspectAndCount(job.aspect, (m) => progress(job.id, m))

          // (4) 에디터 비우고 참조 첨부(인물매칭) + 프롬프트 타이핑
          await clearEditor()
          await sleep(rand(200, 400))
          await ensureRefsAttached(job, (m) => progress(job.id, m))
          progress(job.id, '프롬프트 입력 중…')
          await setPromptText(job.prompt || '')

          // (5) 체크포인트 2 — 앞 이미지 80% 에서 Generate
          if (activeGens.length > 0) {
            const last2 = activeGens[activeGens.length - 1]
            if (!last2.resolved) await waitForGenProgress(last2, 80, job.id)
          }
          if (isCanceled()) throw new Error('취소됨')

          await sleep(rand(300, 700))
          progress(job.id, '생성 클릭…')
          await clickGenerate(isCanceled)
          activeGens.push(createGen(job))
          startWatcher()
          progress(job.id, '생성 시작 — 이미지 대기 중…')
        } catch (e) {
          canceled.delete(job.id)
          failMsg(job.id, (e && e.message) || String(e))
        }

        // (6) 다음 컷 준비 전 짧은 랜덤 간격
        await sleep(rand(800, 1500))
      }
    } finally {
      pumpRunning = false
    }
  }

  // ── ISOLATED(flow.js) 와의 postMessage 다리 ────────────────────────────
  window.addEventListener('message', (e) => {
    if (window.__tbbookFlowToken !== MY_TOKEN) return // 확장 재로드로 교체된 구 인스턴스
    if (e.source !== window) return
    const d = e.data
    if (!d || d.tag !== TAG || d.dir !== 'req') return
    if (d.action === 'cancel') {
      canceled.add(d.id)
      return
    }
    if (d.action !== 'generate') return
    queue.push(d.job)
    progress(d.id, '큐 등록 (' + (queue.length + activeGens.length) + '번째)')
    pump()
  })

  console.log('[TBBOOK-FLOW] MAIN world 자동화 준비 완료 (단일 프로젝트 큐 + 30%/80% 파이프라인)')
})()
