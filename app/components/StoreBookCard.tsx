"use client";

import Link from "next/link";
import { Eye, Heart } from "lucide-react";
import type { StoreBook } from "../lib/store";
import { formatPrice } from "../lib/format-price";

/**
 * 북스토어 책 카드 — 스토어 홈의 추천/선반과 /store/all 그리드가 공유한다.
 * 마크업·클래스는 기존 store-card 인라인 버전과 1:1 (CSS 무변경).
 */
export default function StoreBookCard({
  book,
  openingId,
  onOpen,
  onPreview,
}: {
  book: StoreBook;
  openingId: string | null;
  onOpen: (b: StoreBook) => void;
  onPreview: (b: StoreBook) => void;
}) {
  return (
    <div className="store-card">
      <button
        type="button"
        className="store-card__coverbtn"
        onClick={() => onOpen(book)}
        disabled={openingId !== null}
      >
        <div className="store-card__cover">
          {book.coverThumb ? (
            <img src={book.coverThumb} alt={book.title} loading="lazy" decoding="async" />
          ) : (
            <span>표지</span>
          )}
          {openingId === book.id && (
            <span className="store-card__loading">여는 중…</span>
          )}
        </div>
      </button>
      <div className="store-card__title">{book.title}</div>
      <div className="store-card__author">
        <Link
          href={`/author/${book.ownerId}`}
          className="store-card__authorlink"
          title={`${book.author ?? book.ownerName} 작가의 다른 책 보기`}
        >
          {book.author ?? book.ownerName}
        </Link>
        {book.category && (
          <span className="store-card__cat">{book.category}</span>
        )}
      </div>
      <div className="store-card__meta">
        <span className="store-card__price">{formatPrice(book.price)}</span>
        <span className="store-card__stat" title="조회수">
          <Eye size={14} /> {book.viewCount ?? 0}
        </span>
        <span className="store-card__likes">
          <Heart size={14} fill="currentColor" /> {book.likeCount ?? 0}
        </span>
      </div>
      <button
        type="button"
        className="store-card__preview"
        onClick={() => onPreview(book)}
      >
        <Eye size={15} /> 미리보기
      </button>
    </div>
  );
}
