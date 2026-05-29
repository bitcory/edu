import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="auth-shell">
      <div className="auth-signin">
        <h1 className="auth-title">MAGIC BOOK</h1>
        <p className="auth-sub">로그인하고 그림책을 만들고 펼쳐 보세요.</p>
        <SignIn />
      </div>
    </main>
  );
}
