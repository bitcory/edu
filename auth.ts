import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { findUserById, verifyUser } from "./app/lib/users-repo";

/**
 * Auth.js(next-auth v5) — 아이디/비밀번호 단일 공급자, JWT 세션(DB 어댑터 없음).
 * Credentials 공급자는 세션 전략이 JWT 로 강제된다. 계정 자체는 로컬 Postgres
 * 의 users 테이블에 있고(app/lib/users-repo.ts), 세션에는 검증된 결과만 담긴다.
 *
 * session.user.id 는 users.user_id — 다른 테이블의 owner_id / user_id 가 가리키는 값.
 *
 * Next 16 의 proxy 는 Node.js 런타임이 기본이라 이 파일이 DB(pg)를 직접 import 해도
 * 된다. edge 용 설정 분리(auth.config.ts)가 필요 없다.
 *
 * trustHost: kid.toolb.kr / localhost 어디서 서빙되든 요청 Host 로 콜백 URL 을
 * 만든다 — AUTH_URL 불필요.
 */

/** 로그인 없이 접근할 수 있는 경로. PWA 설치 자산은 인증 리다이렉트에 막히면
 * 설치 프롬프트와 서비스워커가 깨지므로 반드시 열어둔다. */
function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    // 회원가입 자체는 로그아웃 상태에서 호출된다 — 막으면 가입이 불가능하다.
    pathname === "/api/register" ||
    // /api/auth 를 막으면 로그인 콜백이 무한루프에 빠진다 — 반드시 통과.
    pathname.startsWith("/api/auth") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js"
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "아이디 로그인",
      credentials: {
        username: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        const username = String(credentials?.username ?? "");
        const password = String(credentials?.password ?? "");
        if (!username || !password) return null;
        const user = await verifyUser(username, password);
        if (!user) return null;
        // 반환값이 곧 jwt 콜백의 `user` — 비밀번호 해시는 절대 싣지 않는다.
        return {
          id: user.id,
          name: user.displayName,
          username: user.username,
          isAdmin: user.isAdmin,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/sign-in" },
  callbacks: {
    async jwt({ token, user }) {
      // user 는 최초 로그인 때만 채워진다.
      if (user) {
        token.sub = user.id;
        token.username = user.username;
        token.isAdmin = user.isAdmin;
        return token;
      }
      // 이후 요청마다 DB 에서 권한을 다시 읽는다. 토큰에 굳혀 두면 관리자 권한을
      // 준 뒤 다시 로그인해야 반영되고, 더 나쁘게는 **회수해도 토큰이 만료될
      // 때까지 계속 관리자로 남는다.** 로컬 PG 의 PK 조회라 비용은 무시할 만하다.
      if (token.sub) {
        try {
          const fresh = await findUserById(token.sub);
          if (fresh) {
            token.username = fresh.username;
            token.isAdmin = fresh.isAdmin;
          }
        } catch {
          // DB 가 잠깐 안 될 때 전원 로그아웃되는 것보다는 직전 값을 유지한다.
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      // JWT 는 Record<string, unknown> 이라 여기서 좁힌다. (next-auth/jwt 를
      // declare module 로 증강해도 실제 JWT 는 @auth/core/jwt 것이라 안 먹는다.)
      session.user.username =
        typeof token.username === "string" ? token.username : "";
      session.user.isAdmin = token.isAdmin === true;
      return session;
    },
    authorized({ auth, request }) {
      if (isPublicPath(request.nextUrl.pathname)) return true;
      return !!auth; // false → pages.signIn 으로 callbackUrl 붙여 리다이렉트
    },
  },
});
