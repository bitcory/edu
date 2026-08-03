"use client";

import Link from "next/link";
import { LogOut, Settings, Shield } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

export default function UserChip() {
  const { data: session, status } = useSession();
  const user = session?.user;
  if (status === "loading" || !user) return null;

  const name = user.name || user.username || "사용자";
  const admin = user.isAdmin === true;

  return (
    <div className="user-chip">
      <Link href="/library" className="user-chip__name" title="내 서재">
        {name}
      </Link>
      {admin && (
        <Link href="/admin" className="user-chip__admin" title="관리자 페이지">
          <Shield size={12} /> 관리자
        </Link>
      )}
      <Link
        href="/settings"
        className="user-chip__logout"
        title="설정"
        aria-label="설정"
      >
        <Settings size={14} />
      </Link>
      <button
        type="button"
        className="user-chip__logout"
        onClick={() => void signOut({ redirectTo: "/sign-in" })}
        title="로그아웃"
        aria-label="로그아웃"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
