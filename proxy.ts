export { auth as proxy } from "./auth";

// Next 16 renamed `middleware` → `proxy`. Auth.js 의 auth 를 proxy 로 내보내면
// 매 요청마다 auth.ts 의 authorized 콜백이 돌아 전체 앱을 로그인으로 게이트한다
// (/sign-in, /api/auth 만 공개 — auth.ts 참조).

// /api/files is deliberately OFF the matcher. When proxy runs, Next buffers the
// whole request body in memory (proxyClientMaxBodySize, 10MB default) and past
// that limit it silently truncates the body instead of failing — which would
// corrupt large PDF/MP3 uploads. That route authenticates with the HMAC
// signature on its URL instead of the session (see app/lib/pdf-storage.ts).
export const config = {
  matcher: [
    // All routes except Next internals, static files, and the file route…
    "/((?!api/files|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|webp|avif|gif|svg)$).*)",
    // …and always run for API routes other than /api/files.
    "/(api(?!/files)|trpc)(.*)",
  ],
};
