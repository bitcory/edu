"use client";

import Link from "next/link";
import { BookOpen, Eye, Heart, Library, Search, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BookViewer from "../components/BookViewer";
import BookPreviewModal from "../components/BookPreviewModal";
import AuthorPickerModal from "../components/AuthorPickerModal";
import UserChip from "../components/auth/UserChip";
import {
  getBookAudioUrl,
  getNarrationUrls,
  listStoreBooks,
  recordBookRead,
  type StoreBook,
} from "../lib/store";
import { openBookForReading } from "../lib/render-book";
import { type RenderedPage } from "../lib/pdf-to-images";
import { formatPrice } from "../lib/format-price";
import { BOOK_CATEGORIES } from "../lib/categories";
import { pickRandomPoolBgm } from "../lib/bgm";

type Reader = {
  pages: RenderedPage[];
  revoke: () => void;
  single: boolean;
  webtoon: boolean;
  audioUrl?: string;
  narrationUrls?: (string | null)[];
};

export default function StorePage() {
  const [books, setBooks] = useState<StoreBook[] | null>(null);
  const [reader, setReader] = useState<Reader | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null); // null = 전체
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [preview, setPreview] = useState<StoreBook | null>(null);
  const [authorPicker, setAuthorPicker] = useState(false);
  // 점진 렌더: 처음엔 PAGE_SIZE 권만 카드로 그리고, 하단 센티널이 화면에
  // 들어오면 PAGE_SIZE 씩 늘린다. 커버 <img loading="lazy"> 와 함께 —
  // 전체 커버를 한 번에 내려받아 스토어 첫 화면이 느리던 문제의 해법.
  const PAGE_SIZE = 12;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listStoreBooks().then(setBooks);
  }, []);

  // Filter by title or author (지은이 falls back to the uploader's name).
  // Normalize to NFC so 분해형(NFD) 한글 입력도 조합형 제목과 매칭된다.
  const filtered = useMemo(() => {
    if (!books) return null;
    const norm = (s: string) => s.toLowerCase().normalize("NFC");
    const q = norm(query.trim());
    const list = books.filter((b) => {
      if (cat && (b.category ?? "") !== cat) return false;
      if (!q) return true;
      return (
        norm(b.title).includes(q) ||
        norm(b.author ?? b.ownerName).includes(q)
      );
    });
    if (sort === "popular") {
      // 인기순: 좋아요를 크게, 조회수를 작게 가중 (서버 순서는 최신순이라
      // 동점이면 자연스럽게 최신이 앞에 온다).
      return [...list].sort(
        (a, b) =>
          (b.likeCount ?? 0) * 3 + (b.viewCount ?? 0) -
          ((a.likeCount ?? 0) * 3 + (a.viewCount ?? 0)),
      );
    }
    return list;
  }, [books, query, cat, sort]);

  // 검색어·카테고리·정렬이 바뀌면 점진 렌더를 처음부터 다시 시작.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, cat, sort]);

  const visible = useMemo(
    () => (filtered ? filtered.slice(0, visibleCount) : null),
    [filtered, visibleCount],
  );
  const hasMore = !!filtered && filtered.length > visibleCount;

  // 하단 센티널이 보이면 다음 묶음 렌더 (무한 스크롤).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((v) => v + PAGE_SIZE);
        }
      },
      { rootMargin: "600px 0px" }, // 스크롤이 닿기 전에 미리 로드
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore]);

  // Show the full category menu (so it's always navigable). Categories with no
  // books just land on an empty state — existing books predate the category
  // column and read as "미분류" until edited.
  const activeCats = BOOK_CATEGORIES;

  useEffect(() => {
    return () => {
      reader?.revoke();
    };
  }, [reader]);

  const open = useCallback(async (book: StoreBook) => {
    setOpening(book.id);
    try {
      const { rendered, revoke } = await openBookForReading(book);
      // The book's own music wins; otherwise a random shared-pool track plays.
      let audioUrl = book.audioKey
        ? ((await getBookAudioUrl(book.id)) ?? undefined)
        : undefined;
      if (!audioUrl) audioUrl = await pickRandomPoolBgm();
      const nUrls = await getNarrationUrls(book.id);
      setReader({
        pages: rendered,
        revoke,
        single: book.layout === "single",
        webtoon: book.layout === "webtoon",
        audioUrl,
        narrationUrls: nUrls.some(Boolean) ? nUrls : undefined,
      });
      // Log the read for the monthly author settlement (server dedupes per
      // month and ignores self-reads / non-logged-in / unpublished).
      void recordBookRead(book.id);
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
        webtoon={reader.webtoon}
        audioUrl={reader.audioUrl}
        narrationUrls={reader.narrationUrls}
        onClose={() => setReader(null)}
      />
    );
  }

  return (
    <main className="store-shell">
      <header className="store-header">
        <Link href="/" className="home-btn" aria-label="처음으로" title="처음으로" />
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

      {books && books.length > 0 && (
        <div className="store-cats" role="tablist" aria-label="정렬">
          <button
            type="button"
            className={`store-cat${sort === "latest" ? " is-active" : ""}`}
            onClick={() => setSort("latest")}
          >
            최신순
          </button>
          <button
            type="button"
            className={`store-cat${sort === "popular" ? " is-active" : ""}`}
            onClick={() => setSort("popular")}
          >
            인기순
          </button>
        </div>
      )}

      {activeCats.length > 0 && (
        <div className="store-cats" role="tablist" aria-label="카테고리">
          <button
            type="button"
            className={`store-cat${cat === null ? " is-active" : ""}`}
            onClick={() => setCat(null)}
          >
            전체
          </button>
          {activeCats.map((c) => (
            <button
              key={c}
              type="button"
              className={`store-cat${cat === c ? " is-active" : ""}`}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
          <button
            type="button"
            className="store-cat store-cat--authors"
            onClick={() => setAuthorPicker(true)}
            title="등록된 작가들의 프로필 보기"
          >
            <Users size={15} /> 작가선택
          </button>
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
          <p>
            {query.trim()
              ? `“${query.trim()}”에 맞는 책이 없어요.`
              : `‘${cat}’ 카테고리에 아직 책이 없어요.`}
          </p>
        </div>
      ) : (
        <div className="store-grid">
          {(visible ?? []).map((b) => (
            <div key={b.id} className="store-card">
              <button
                type="button"
                className="store-card__coverbtn"
                onClick={() => void open(b)}
                disabled={opening !== null}
              >
                <div className="store-card__cover">
                  {b.coverThumb ? (
                    <img src={b.coverThumb} alt={b.title} loading="lazy" decoding="async" />
                  ) : (
                    <span>표지</span>
                  )}
                  {opening === b.id && (
                    <span className="store-card__loading">여는 중…</span>
                  )}
                </div>
              </button>
              <div className="store-card__title">{b.title}</div>
              <div className="store-card__author">
                <Link
                  href={`/author/${b.ownerId}`}
                  className="store-card__authorlink"
                  title={`${b.author ?? b.ownerName} 작가의 다른 책 보기`}
                >
                  {b.author ?? b.ownerName}
                </Link>
                {b.category && (
                  <span className="store-card__cat">{b.category}</span>
                )}
              </div>
              <div className="store-card__meta">
                <span className="store-card__price">{formatPrice(b.price)}</span>
                <span className="store-card__stat" title="조회수">
                  <Eye size={14} /> {b.viewCount ?? 0}
                </span>
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
          {hasMore && (
            <div
              ref={sentinelRef}
              className="store-sentinel"
              aria-hidden
              // grid 한 줄을 통째로 차지해 관찰이 안정적이도록.
              style={{ gridColumn: "1 / -1", height: 1 }}
            />
          )}
        </div>
      )}

      {authorPicker && (
        <AuthorPickerModal onClose={() => setAuthorPicker(false)} />
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
