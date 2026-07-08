"use client";

import Link from "next/link";
import { LogOut, Shield } from "lucide-react";
import { useClerk, useUser } from "@clerk/nextjs";
import { isAdminEmail } from "../../lib/admin-emails";

export default function UserChip() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  if (!isLoaded || !user) return null;

  const email = user.primaryEmailAddress?.emailAddress;
  const name =
    user.firstName || user.username || user.fullName || email?.split("@")[0] || "사용자";
  const admin = isAdminEmail(email);

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
      <button
        type="button"
        className="user-chip__logout"
        onClick={() => void signOut({ redirectUrl: "/sign-in" })}
        title="로그아웃"
        aria-label="로그아웃"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
