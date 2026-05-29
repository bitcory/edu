"use client";

import Link from "next/link";
import { BookOpen, Eye, Heart, Home, Library, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import BookViewer from "../components/BookViewer";
import BookPreviewModal from "../components/BookPreviewModal";
import UserChip from "../components/auth/UserChip";
import { listStoreBooks, type StoreBook } from "../lib/store";
import { openBookForReading } from "../lib/render-book";
import { type RenderedPage } from "../lib/pdf-to-images";
import { formatPrice } from "../lib/format-price";

type Reader = { pages: RenderedPage[]; revoke: () => void; single: boolean };

export default function StorePage() {
  const [books, setBooks] = useState<StoreBook[] | null>(null);
  const [reader, setReader] = useState<Reader | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<StoreBook | null>(null);

  useEffect(() => {
    listStoreBooks().then(setBooks);
  }, []);

  // Filter by title or author (지은이 falls back to the uploader's name).
  const filtered = useMemo(() => {
    if (!books) return null;
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.author ?? b.ownerName).toLowerCase().includes(q),
    );
  }, [books, query]);

  useEffect(() => {
    return () => {
      reader?.revoke();
    };
  }, [reader]);

  const open = useCallback(async (book: StoreBook) => {
    setOpening(book.id);
    try {
      const { rendered, revoke } = await openBookForReading(book);
      setReader({ pages: rendered, revoke, single: book.layout === "single" });
    } catch (err) {
      alert("책을 여는 중 문제가 생겼어요: " + (err as Error).message);
    } finally {
      setOpening(null);
    }
  }, []);

  if (reader) {
    return (
      <BookViewer
        pages={reader.pages}
        singlePage={reader.single}
        onClose={() => setReader(null)}
      />
    );
  }

  return (
    <main className="store-shell">
      <header className="store-header">
        <Link href="/" className="home-btn" aria-label="처음으로" title="처음으로">
          <Home size={26} strokeWidth={2} />
        </Link>
        <h1 className="store-title">북스토어</h1>
        <div className="store-header__right">
          <Link href="/library" className="store-navlink">
            <Library size={16} /> 내 서재
          </Link>
          <UserChip />
        </div>
      </header>

      {books && books.length > 0 && (
        <div className="store-search">
          <Search size={18} className="store-search__icon" aria-hidden />
          <input
            type="search"
            className="store-search__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목이나 지은이로 검색"
            aria-label="제목이나 지은이로 검색"
          />
        </div>
      )}

      {books === null ? (
        <p className="store-empty">불러오는 중…</p>
      ) : books.length === 0 ? (
        <div className="store-empty">
          <BookOpen size={40} strokeWidth={1.6} />
          <p>아직 공개된 책이 없어요. 첫 책을 만들어 올려 보세요!</p>
          <Link href="/edit" className="store-cta">
            책 만들러 가기
          </Link>
        </div>
      ) : filtered && filtered.length === 0 ? (
        <div className="store-empty">
          <Search size={40} strokeWidth={1.6} />
          <p>&ldquo;{query.trim()}&rdquo;에 맞는 책이 없어요.</p>
        </div>
      ) : (
        <div className="store-grid">
          {(filtered ?? []).map((b) => (
            <div key={b.id} className="store-card">
              <button
                type="button"
                className="store-card__coverbtn"
                onClick={() => void open(b)}
                disabled={opening !== null}
              >
                <div className="store-card__cover">
                  {b.coverThumb ? (
                    <img src={b.coverThumb} alt={b.title} />
                  ) : (
                    <span>표지</span>
                  )}
                  {opening === b.id && (
                    <span className="store-card__loading">여는 중…</span>
                  )}
                </div>
              </button>
              <div className="store-card__title">{b.title}</div>
              <div className="store-card__author">{b.author ?? b.ownerName}</div>
              <div className="store-card__meta">
                <span className="store-card__price">{formatPrice(b.price)}</span>
                <span className="store-card__likes">
                  <Heart size={14} fill="currentColor" /> {b.likeCount ?? 0}
                </span>
              </div>
              <button
                type="button"
                className="store-card__preview"
                onClick={() => setPreview(b)}
              >
                <Eye size={15} /> 미리보기
              </button>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <BookPreviewModal
          book={preview}
          onClose={() => setPreview(null)}
          onRead={() => {
            const b = preview;
            setPreview(null);
            void open(b);
          }}
          onLikeChange={(likeCount) =>
            setBooks(
              (prev) =>
                prev?.map((x) =>
                  x.id === preview.id ? { ...x, likeCount } : x,
                ) ?? prev,
            )
          }
        />
      )}
    </main>
  );
}
