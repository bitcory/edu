"use client";

import Link from "next/link";
import { Heart, X } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchAuthorDirectory } from "../lib/author-store";
import type { AuthorCard } from "../lib/author-types";

/** A modal grid of approved-author profile cards. Picking one navigates to that
 *  author's page. */
export default function AuthorPickerModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [authors, setAuthors] = useState<AuthorCard[] | null>(null);

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
          <div className="apick-grid">
            {authors.map((a) => (
              <Link
                key={a.userId}
                href={`/author/${a.userId}`}
                className="apick-card"
                onClick={onClose}
              >
                <span className="apick-card__avatar" aria-hidden>
                  {a.displayName.slice(0, 1)}
                </span>
                <span className="apick-card__name">{a.displayName}</span>
                {a.intro && (
                  <span className="apick-card__intro">{a.intro}</span>
                )}
                <span className="apick-card__stats">
                  책 {a.bookCount} ·{" "}
                  <Heart size={12} fill="currentColor" /> {a.totalLikes}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
