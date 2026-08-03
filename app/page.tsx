import Link from "next/link";
import { ArrowRight, Library, Pencil, Sparkles, Store, Wand2 } from "lucide-react";
import UserChip from "./components/auth/UserChip";

export default function Home() {
  return (
    <main className="landing-shell">
      <div className="landing-userbar">
        <Link href="/library" className="landing-navlink">
          <Library size={16} /> 내 서재
        </Link>
        <UserChip />
      </div>

      <header className="landing-header">
        <h1 className="landing-title" aria-label="MAGIC BOOK">
          <span>MAGIC BOOK</span>
        </h1>
        <p className="landing-sub">
          그림책을 골라서 만들고, 직접 만든 책은 북스토어에 올려 보세요.
        </p>
      </header>

      <div className="landing-grid">
        <Link href="/make" className="landing-card landing-card--make">
          <div className="landing-card__icon" aria-hidden>
            <Wand2 size={48} strokeWidth={1.6} />
          </div>
          <div className="landing-card__body">
            <h2 className="landing-card__title">그림책 만들기</h2>
            <p className="landing-card__desc">
              주인공과 이야기를 고르면 내 이름이 들어간 그림책이 뚝딱
            </p>
            <span className="landing-card__cta">
              골라서 만들기 <ArrowRight size={16} />
            </span>
          </div>
        </Link>

        <Link href="/story" className="landing-card landing-card--story">
          <div className="landing-card__icon" aria-hidden>
            <Sparkles size={48} strokeWidth={1.6} />
          </div>
          <div className="landing-card__body">
            <h2 className="landing-card__title">스토리구성</h2>
            <p className="landing-card__desc">
              이야기·캐릭터·컷을 정리해 그림책 제작 프롬프트 만들기
            </p>
            <span className="landing-card__cta">
              구성하기 <ArrowRight size={16} />
            </span>
          </div>
        </Link>

        <Link href="/edit" className="landing-card landing-card--edit">
          <div className="landing-card__icon" aria-hidden>
            <Pencil size={48} strokeWidth={1.6} />
          </div>
          <div className="landing-card__body">
            <h2 className="landing-card__title">책 만들기</h2>
            <p className="landing-card__desc">
              이미지를 올리고 글자를 적어 나만의 그림책 만들기
            </p>
            <span className="landing-card__cta">
              새 책 만들기 <ArrowRight size={16} />
            </span>
          </div>
        </Link>

        <Link href="/store" className="landing-card landing-card--store">
          <div className="landing-card__icon" aria-hidden>
            <Store size={48} strokeWidth={1.6} />
          </div>
          <div className="landing-card__body">
            <h2 className="landing-card__title">북스토어</h2>
            <p className="landing-card__desc">
              친구들이 만든 그림책을 둘러보고, 내 책도 올려 보기
            </p>
            <span className="landing-card__cta">
              구경하기 <ArrowRight size={16} />
            </span>
          </div>
        </Link>
      </div>
    </main>
  );
}
