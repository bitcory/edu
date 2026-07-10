import { redirect } from "next/navigation";
import { auth } from "../../auth";
import GoogleSignInButton from "./GoogleSignInButton";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  // 이미 로그인 상태면 통과 (기존 Clerk 위젯의 동작 재현).
  const session = await auth();
  if (session) redirect(callbackUrl || "/");

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <span className="auth-cover-band" />
        <h1 className="auth-title">MAGIC BOOK</h1>
        <p className="auth-sub">로그인하고 그림책을 만들고 펼쳐 보세요.</p>
        <GoogleSignInButton callbackUrl={callbackUrl || "/"} />
      </div>
    </main>
  );
}
