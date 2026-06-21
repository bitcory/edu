# TB Magic Book — 이미지 생성 도우미 (Chrome 확장)

스토리구성(`/story`) 화면의 "이미지 생성"에서 **ChatGPT 엔진**을 선택하면, 이 확장이
당신의 로그인된 ChatGPT 탭을 자동으로 조작해 이미지를 만들고 결과를 화면으로 가져옵니다.

> ai-video-studio(TB MTOOL)의 확장과는 **완전히 별개**입니다. 이 확장만 따로
> 설치하면 되고, 기존 앱/확장에는 아무 영향이 없습니다.

## 설치 (압축 해제된 확장 로드)

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 이 폴더(`tbbook-imagegen-ext`)를 선택

## 사용

1. ChatGPT(`chatgpt.com`)에 **로그인**되어 있어야 합니다.
2. tbbook(`http://localhost:3000` 또는 `https://tbbook.aitoolb.com`)의 `/story` →
   캐릭터 시트 → 이미지 섹션에서 엔진을 **ChatGPT**로 두고 **이미지 생성**.
3. 확장이 chatgpt.com 탭을 열어 프롬프트를 넣고 이미지를 생성한 뒤, 결과를
   `/story` 화면의 이미지 박스로 가져옵니다. **정지**로 취소할 수 있습니다.

## 동작 방식 (요약)

```
/story 페이지 ──postMessage──▶ bridge.js ──runtime──▶ background.js
                                                          │ chatgpt 탭 열기/조작
                                                          ▼
                                                   chatgpt.js (DOM 자동화)
                                                          │ 생성 이미지 스크랩
/story 페이지 ◀──postMessage── bridge.js ◀──runtime── background.js
```

- 페이지는 `window.postMessage`만 사용 → 확장이 없으면 자동으로 **API 엔진**으로 폴백.
- `chatgpt.js`의 DOM 자동화 로직은 ai-video-studio `automate.js`에서 재사용.

## 배포 도메인 추가

다른 도메인에서도 쓰려면 `manifest.json`의 `content_scripts[].matches`(bridge.js 항목)에
도메인을 추가하세요. 현재: `localhost`, `127.0.0.1`, `tbbook.aitoolb.com`.
