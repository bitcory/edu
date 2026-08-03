"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";

/** 아이디/비밀번호 로그인 폼. Google 버튼을 대체한다. */
export default function CredentialsSignInForm({
  callbackUrl,
}: {
  callbackUrl: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // redirect:false 라야 실패 사유를 이 화면에서 보여줄 수 있다.
    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    }).catch(() => null);
    if (!res || res.error) {
      setError("아이디 또는 비밀번호가 맞지 않아요.");
      setBusy(false);
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label className="auth-field">
        <span>아이디</span>
        <input
          type="text"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </label>
      <label className="auth-field">
        <span>비밀번호</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="auth-submit" disabled={busy}>
        {busy ? "확인 중…" : "로그인"}
      </button>
      <p className="auth-alt">
        아직 계정이 없나요?{" "}
        <Link href={`/sign-up?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
          회원가입
        </Link>
      </p>
    </form>
  );
}
