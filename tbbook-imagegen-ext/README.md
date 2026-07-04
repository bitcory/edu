# TB Magic Book — 이미지 생성 도우미 (Chrome 확장)

스토리구성(`/story`) 화면에서 "이미지 생성"을 누르면, 이 확장이 당신의 로그인된
**ChatGPT** 또는 **Google Flow(labs.google)** 탭을 자동으로 조작해 이미지를 만들고
결과를 화면으로 가져옵니다. 엔진은 `/story` 상단바의 **ChatGPT / Flow** 토글로 고릅니다.

> ai-video-studio(TB MTOOL)의 확장과는 **완전히 별개**입니다. 이 확장만 따로
> 설치하면 되고, 기존 앱/확장에는 아무 영향이 없습니다.

## 설치 (압축 해제된 확장 로드)

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 이 폴더(`tbbook-imagegen-ext`)를 선택

## 사용

1. 쓸 엔진에 **로그인**되어 있어야 합니다 — ChatGPT(`chatgpt.com`) 또는
   Flow(`labs.google`, 구글 계정).
2. tbbook(`http://localhost:3000` 또는 `https://tbbook.aitoolb.com`)의 `/story` →
   상단바에서 엔진(**ChatGPT / Flow**)을 고르고 **이미지 생성**(단건/전체생성 모두 적용).
3. 확장이 해당 사이트 탭을 열어 프롬프트를 넣고 이미지를 생성한 뒤, 결과를
   `/story` 화면의 이미지 박스로 가져옵니다. **정지**로 취소할 수 있습니다.

## 동작 방식 (요약)

```
/story 페이지 ──postMessage──▶ bridge.js ──runtime──▶ background.js
                                                          │ 엔진별 탭 열기/조작
                                                          ▼
                                        chatgpt.js  또는  flow.js + flow-main.js
                                        (DOM 자동화)      (ISOLATED ↔ MAIN world)
                                                          │ 생성 이미지 스크랩
/story 페이지 ◀──postMessage── bridge.js ◀──runtime── background.js
```

- 페이지는 `window.postMessage`만 사용 → 확장이 없으면 자동으로 **API 엔진**으로 폴백.
- `chatgpt.js`의 DOM 자동화 로직은 ai-video-studio `automate.js`에서 재사용.
- Flow 자동화(`flow-main.js`)는 ai-video-studio 확장의 검증된 로직을 이식.
  Flow 생성 버튼은 합성클릭(isTrusted)을 막아 MAIN world에서 React `onClick`을
  직접 호출해야 하고(→ `flow-main.js`), `chrome.runtime` 통신은 ISOLATED world의
  `flow.js`가 맡아 `window.postMessage`로 다리를 놓는다. 완성된 Flow 이미지 URL은
  content script에서 CORS로 못 받아 `background.js`가 대신 fetch(쿠키 포함)한다.

## 업데이트 (자동 업데이트 없음 → 알림으로 보완)

이 확장은 chatgpt.com을 자동화하므로 Chrome 웹스토어에 올릴 수 없어, **자동
업데이트가 없다.** 각자 폴더를 받아 `chrome://extensions`에서 다시 로드해야 한다.
대신 앱이 **구버전을 감지해 배너로 알려준다**:

1. `bridge.js`가 `manifest.json`의 `version`을 `/story` 페이지로 보낸다.
2. 페이지는 `GET /api/ext/latest`(`{ version, downloadUrl }`)와 비교해, 설치된
   버전이 더 낮으면 상단에 "업데이트 필요" 배너 + 다운로드 링크를 띄운다.

**새 빌드 배포 절차**

1. `manifest.json`의 `version`을 올린다 (예: `0.1.1` → `0.1.2`).
2. `bash tbbook-imagegen-ext/pack.sh` 실행 → `public/tbbook-imagegen-ext.zip`
   재생성. 앱이 `/tbbook-imagegen-ext.zip` 으로 그대로 서빙한다(파일명 고정).
3. 서버 환경변수를 갱신한다:
   - `EXT_LATEST_VERSION` = 올린 버전 (미설정 시 라우트의 fallback 상수 사용)
   - `EXT_DOWNLOAD_URL` = `/tbbook-imagegen-ext.zip` (배너의 "새 버전 받기" 버튼)
4. 배포(zip 커밋 또는 빌드에 포함) 후, 구버전 사용자에게 배너가 떠
   "새 버전 받기" → 압축 풀고 `chrome://extensions`에서 다시 로드 → 최신.

> 다운로드 zip은 stable 파일명(`tbbook-imagegen-ext.zip`)이라 `EXT_DOWNLOAD_URL`은
> 한 번만 정하면 되고, 매 릴리스마다 zip 내용과 `EXT_LATEST_VERSION`만 바꾸면 된다.

## 배포 도메인 추가

다른 도메인에서도 쓰려면 `manifest.json`의 `content_scripts[].matches`(bridge.js 항목)에
도메인을 추가하세요. 현재: `localhost`, `127.0.0.1`, `tbbook.aitoolb.com`.
