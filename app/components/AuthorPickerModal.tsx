"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Heart, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchAuthorDirectory } from "../lib/author-store";
import type { AuthorCard } from "../lib/author-types";

const FEMALE_AUTHOR_PORTRAITS = [
  "/authors/baengle.jpg",
  "/authors/baengle-2.jpg",
  "/authors/rozetheday.jpg",
  "/authors/mignon.jpg",
  "/authors/nana.jpg",
  "/authors/dongdong.jpg",
] as const;

const AUTHOR_PORTRAIT_BY_USER_ID: Record<string, string> = {
  user_3Ew0dgaYdLafxhirQ9Ykj5m4gwS: "/authors/nana.jpg",
  user_3Ew0atuLRpVTHOZuKzay7zBBtOE: "/authors/dongdong.jpg",
  user_3EfjkG1HutfetxWFWW07j1qXgoT: "/authors/rozetheday.jpg",
  user_3EOennveFgx8DtxaaOvAGnc8aIF: "/authors/mignon.jpg",
  user_3ERQTmRgwmJdSdpGvbSPgVAxTpa: "/authors/baengle.jpg",
  user_3EOer3l95a5zd4kHMiHgOP0t9rp: "/authors/baengle-2.jpg",
  user_3ELDfnjKaWT6Ap3Ghy4l6vrvDXT: "/authors/toolbi.jpg",
};

function portraitFor(author: AuthorCard) {
  if (author.avatarUrl) return author.avatarUrl;
  const assignedPortrait = AUTHOR_PORTRAIT_BY_USER_ID[author.userId];
  if (assignedPortrait) return assignedPortrait;

  const name = author.displayName.toLocaleLowerCase("ko-KR").replaceAll(" ", "");

  if (name.includes("툴비") || name.includes("toolbi")) {
    return "/authors/toolbi.jpg";
  }
  if (name.includes("뱅글") || name.includes("baengle")) {
    return "/authors/baengle.jpg";
  }
  if (name.includes("로즈데이") || name.includes("rozetheday")) {
    return "/authors/rozetheday.jpg";
  }
  if (
    name.includes("미뇽") ||
    name.includes("미농") ||
    name.includes("mignon") ||
    name.includes("minong")
  ) {
    return "/authors/mignon.jpg";
  }
  if (name.includes("나나") || name.includes("nana")) {
    return "/authors/nana.jpg";
  }
  if (name.includes("동동") || name.includes("dongdong")) {
    return "/authors/dongdong.jpg";
  }

  const hash = [...author.userId].reduce(
    (value, character) => value + character.charCodeAt(0),
    0,
  );
  return FEMALE_AUTHOR_PORTRAITS[hash % FEMALE_AUTHOR_PORTRAITS.length];
}

/** A horizontally scrollable directory of approved-author profile cards. */
export default function AuthorPickerModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [authors, setAuthors] = useState<AuthorCard[] | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAuthorDirectory().then(setAuthors);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scrollAuthors = (direction: -1 | 1) => {
    scrollerRef.current?.scrollBy({
      left: direction * 272,
      behavior: "smooth",
    });
  };

  return (
    <div className="apick-backdrop" onClick={onClose}>
      <div
        className="apick-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="작가 선택"
      >
        <header className="apick-head">
          <strong>작가 선택</strong>
          <button
            type="button"
            className="apick-close"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </header>

        {authors === null ? (
          <p className="apick-empty">불러오는 중…</p>
        ) : authors.length === 0 ? (
          <p className="apick-empty">아직 등록된 작가가 없어요.</p>
        ) : (
          <div className="apick-carousel">
            <button
              type="button"
              className="apick-nav apick-nav--prev"
              onClick={() => scrollAuthors(-1)}
              aria-label="이전 작가 보기"
            >
              <ChevronLeft size={24} />
            </button>
            <div
              className="apick-scroller"
              ref={scrollerRef}
              role="list"
              aria-label="작가 목록"
            >
              {authors.map((a) => (
                <Link
                  key={a.userId}
                  href={`/author/${a.userId}`}
                  className="apick-card"
                  onClick={onClose}
                  role="listitem"
                  aria-label={`${a.displayName} 작가 페이지 보기`}
                >
                  <span className="apick-card__portrait">
                    {a.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.avatarUrl} alt={`${a.displayName} 작가 프로필`} />
                    ) : (
                      <Image
                        src={portraitFor(a)}
                        alt={`${a.displayName} 작가 프로필`}
                        width={640}
                        height={640}
                        sizes="(max-width: 640px) 72vw, 240px"
                      />
                    )}
                  </span>
                  <span className="apick-card__name">{a.displayName}</span>
                  {a.intro && (
                    <span className="apick-card__intro">{a.intro}</span>
                  )}
                  <span className="apick-card__stats">
                    책 {a.bookCount} ·{" "}
                    <Heart size={14} fill="currentColor" /> {a.totalLikes}
                  </span>
                </Link>
              ))}
            </div>
            <button
              type="button"
              className="apick-nav apick-nav--next"
              onClick={() => scrollAuthors(1)}
              aria-label="다음 작가 보기"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
