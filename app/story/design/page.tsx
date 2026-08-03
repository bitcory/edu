import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import UserChip from "../../components/auth/UserChip";
import DesignForm from "./DesignForm";

export const metadata = { title: "그림책 설계" };

export default function DesignPage() {
  return (
    <main className="store-shell">
      <header className="store-header">
        <Link href="/story" className="design-back">
          <ArrowLeft size={18} /> 스토리구성
        </Link>
        <h1 className="store-title">그림책 설계</h1>
        <div className="store-header__right">
          <UserChip />
        </div>
      </header>
      <DesignForm />
    </main>
  );
}
