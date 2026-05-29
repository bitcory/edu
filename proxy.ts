import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next 16 renamed `middleware` → `proxy`. clerkMiddleware() runs on every
// matched request so server-side auth() works, and gates the whole app.

// Everything except the sign-in flow requires login (full-login scope).
const isPublic = createRouteMatcher(["/sign-in(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // All routes except Next internals and static files…
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)",
    // …and always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
