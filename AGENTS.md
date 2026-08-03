<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 이 앱은 자체 호스팅이다 — 외부 서비스에 의존하지 않는다

맥미니에서 `next start -p 3310` 으로 돌고 cloudflared 터널로 `kid.toolb.kr` 에 서빙된다.
Vercel·Neon·R2·Google OAuth 를 **의도적으로 전부 걷어냈다.** 되돌리지 말 것.

| 관심사 | 구현 | 단일 진입점 |
|---|---|---|
| DB | 로컬 PostgreSQL (`pg` 풀) | `app/lib/db.ts` |
| 블롭 저장소 | 로컬 디스크 (`STORAGE_DIR`) | `app/lib/pdf-storage.ts` |
| 인증 | 자체 아이디/비밀번호 (Auth.js Credentials) | `auth.ts`, `app/lib/users-repo.ts` |

- 스키마는 마이그레이션 도구 없이 `ensureSchema()` 가 `CREATE TABLE IF NOT EXISTS` 로 만든다.
  컬럼 추가는 그 안에 `ADD COLUMN IF NOT EXISTS` 로 덧붙인다.
- 리포지토리 모듈은 `db.execute()` 만 쓴다 (`?` 플레이스홀더 → 내부에서 `$1` 변환).
  드라이버를 직접 import 하지 말 것.
- `presign*` 함수는 이름만 S3 유산이고 실제로는 `/api/files/<key>` 로 가는 HMAC 서명 URL을
  돌려준다. 서명이 곧 인가다.

## 건드리기 전에 알아야 할 함정

- **`/api/files` 는 `proxy.ts` 의 matcher에서 빠져 있다.** proxy 가 걸리면 Next 가 요청 body를
  메모리에 버퍼링하고 한도(`proxyClientMaxBodySize`, 50mb)를 넘으면 **에러 없이 잘라버린다.**
  이 라우트를 matcher 에 도로 넣으면 큰 PDF·MP3 업로드가 조용히 깨진다.
- **비밀번호 해시는 `node:crypto` 의 scrypt** 다. 외부 해시 라이브러리를 추가하지 말 것.
- **JWT 타입은 증강하지 않는다.** 실제 인터페이스가 `@auth/core/jwt` 에 있어서
  `declare module "next-auth/jwt"` 가 먹지 않는다. `auth.ts` 의 session 콜백에서 좁혀 쓴다.
- 관리자 여부는 세션의 `isAdmin` 이다 (`users.is_admin` 또는 `ADMIN_USERNAMES`).
  이메일 기반 판정은 제거됐다.

## 배포

```
cd /Users/toolb/tb/dev/edu && npm run build \
  && launchctl kickstart -k gui/$(id -u)/com.toolb.kid
```

`upstream` 리모트는 원본 `bitcory/tbbook` 이다 — 공통 파일의 버그픽스는 cherry-pick 할 수 있다.
