import { redirect } from "next/navigation";
import { auth } from "../../auth";
import SignUpForm from "./SignUpForm";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const session = await auth();
  if (session) redirect(callbackUrl || "/");

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <span className="auth-cover-band" />
        <h1 className="auth-title">회원가입</h1>
        <p className="auth-sub">아이디와 비밀번호만 있으면 시작할 수 있어요.</p>
        <SignUpForm callbackUrl={callbackUrl || "/"} />
      </div>
    </main>
  );
}
