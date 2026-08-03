"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";

/** 회원가입 → 성공 시 곧바로 로그인까지 이어서 처리한다. 수집 항목은 아이디,
 * 비밀번호, 표시 이름뿐 — 이용자가 영유아라 개인정보는 최소로만 받는다. */
export default function SignUpForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password, displayName }),
    }).catch(() => null);

    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setError(data?.error ?? "가입에 실패했어요. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
      return;
    }

    const signedIn = await signIn("credentials", {
      username,
      password,
      redirect: false,
    }).catch(() => null);
    if (!signedIn || signedIn.error) {
      // 계정은 만들어졌으니 로그인 화면으로 보내 다시 시도하게 한다.
      router.push("/sign-in");
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
        <small>영문 소문자·숫자·밑줄 4~20자</small>
      </label>
      <label className="auth-field">
        <span>비밀번호</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <small>8자 이상</small>
      </label>
      <label className="auth-field">
        <span>표시 이름</span>
        <input
          type="text"
          name="displayName"
          autoComplete="nickname"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="비워두면 아이디를 사용해요"
        />
      </label>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="auth-submit" disabled={busy}>
        {busy ? "가입 중…" : "가입하고 시작하기"}
      </button>
      <p className="auth-alt">
        이미 계정이 있나요?{" "}
        <Link href={`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
          로그인
        </Link>
      </p>
    </form>
  );
}
