import Link from "next/link";
import { redirect } from "next/navigation";
import UserChip from "../components/auth/UserChip";
import CredentialsPanel from "../components/CredentialsPanel";
import { getServerUser } from "../lib/server-auth";

export const metadata = { title: "설정" };

export default async function SettingsPage() {
  const user = await getServerUser();
  if (!user) redirect("/sign-in?callbackUrl=%2Fsettings");

  return (
    <main className="store-shell">
      <header className="store-header">
        <Link href="/" className="home-btn" aria-label="처음으로" title="처음으로" />
        <h1 className="store-title">설정</h1>
        <div className="store-header__right">
          <UserChip />
        </div>
      </header>

      <div className="settings-body">
        <h2 className="settings-heading">AI 키</h2>
        <p className="settings-lede">
          그림 생성과 대본·자막에 쓸 키를 넣어 주세요. 사용자마다 각자의 키로
          동작합니다.
        </p>
        <CredentialsPanel endpoint="/api/settings/credentials" variant="user" />
      </div>
    </main>
  );
}
