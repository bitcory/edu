import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js(next-auth v5) — Google 로그인 단일 공급자, JWT 세션(DB 어댑터 없음).
 * session.user.id 는 Google sub(계정 영구 고유번호)로 고정한다. 기존 Clerk
 * userId 로 저장돼 있던 DB 소유권은 scripts/migrate-clerk-to-google.mjs 가
 * Google sub 로 일괄 치환했다 (2026-07 Clerk 제거 마이그레이션).
 *
 * trustHost: 세 도메인(tbbook.aitoolb.com / magic.toolb.kr / localhost:3000)
 * 어디서 서빙되든 요청 Host 로 콜백 URL을 만든다 — AUTH_URL 불필요.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google], // AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET 자동 인식
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/sign-in" },
  callbacks: {
    jwt({ token, account, profile }) {
      // 최초 로그인 시 token.sub 를 Google sub 로 고정 (기본값도 sub 지만 명시).
      if (account?.provider === "google" && profile?.sub) token.sub = profile.sub;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      // /api/auth 를 막으면 로그인 콜백이 무한루프에 빠진다 — 반드시 통과.
      if (pathname.startsWith("/sign-in") || pathname.startsWith("/api/auth")) return true;
      return !!auth; // false → pages.signIn 으로 callbackUrl 붙여 리다이렉트
    },
  },
});
