"use client";

import Link from "next/link";
import {
  BookOpen, ChevronLeft, ChevronRight, Grid3x3, Library, Megaphone, Pin,
  Sparkles, Users, X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import BookViewer from "../components/BookViewer";
import BookPreviewModal from "../components/BookPreviewModal";
import AuthorPickerModal from "../components/AuthorPickerModal";
import StoreBookCard from "../components/StoreBookCard";
import UserChip from "../components/auth/UserChip";
import {
  fetchStoreHome,
  getBookAudioUrl,
  getNarrationUrls,
  recordBookRead,
  type FeaturedBook,
  type StoreBanner,
  type StoreBook,
  type StoreHome,
  type StoreNotice,
  type StoreShelf,
} from "../lib/store";
import { openBookForReading } from "../lib/render-book";
import { type RenderedPage } from "../lib/pdf-to-images";
import { pickRandomPoolBgm } from "../lib/bgm";

type Reader = {
  pages: RenderedPage[];
  revoke: () => void;
  single: boolean;
  webtoon: boolean;
  audioUrl?: string;
  narrationUrls?: (string | null)[];
};

/** 스토어 포털 홈 — 공지 → 이벤트 배너 → 금주의 추천 → 카테고리별 신간 선반.
 * 전체 목록(검색·정렬·페이지네이션)은 /store/all. 데이터는 /api/store/home
 * 단일 fetch. */
export default function StorePage() {
  const [home, setHome] = useState<StoreHome | null>(null);
  const [reader, setReader] = useState<Reader | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [preview, setPreview] = useState<StoreBook | null>(null);
  const [notice, setNotice] = useState<StoreNotice | null>(null);
  const [authorPicker, setAuthorPicker] = useState(false);

  useEffect(() => {
    fetchStoreHome().then(setHome);
  }, []);

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

  // 미리보기 좋아요 토글을 홈 데이터(추천·선반)에 반영.
  const onLikeChange = useCallback(
    (bookId: string, likeCount: number) => {
      setHome((prev) => {
        if (!prev) return prev;
        const patch = <T extends StoreBook>(b: T): T =>
          b.id === bookId ? { ...b, likeCount } : b;
        return {
          ...prev,
          featured: prev.featured.map(patch),
          shelves: prev.shelves.map((s) => ({ ...s, books: s.books.map(patch) })),
        };
      });
    },
    [],
  );

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

  const empty =
    home !== null && home.featured.length === 0 && home.shelves.length === 0;

  return (
    <main className="store-shell">
      <header className="store-header">
        <Link href="/" className="home-btn" aria-label="처음으로" title="처음으로" />
        <h1 className="store-title">북스토어</h1>
        <div className="store-header__right">
          <Link href="/store/all" className="store-navlink">
            <Grid3x3 size={16} /> 전체 책
          </Link>
          <button
            type="button"
            className="store-navlink store-navlink--btn"
            onClick={() => setAuthorPicker(true)}
          >
            <Users size={16} /> 작가들
          </button>
          <Link href="/library" className="store-navlink">
            <Library size={16} /> 내 서재
          </Link>
          <UserChip />
        </div>
      </header>

      {home === null ? (
        <p className="store-empty">불러오는 중…</p>
      ) : empty ? (
        <div className="store-empty">
          <BookOpen size={40} strokeWidth={1.6} />
          <p>아직 공개된 책이 없어요. 첫 책을 만들어 올려 보세요!</p>
          <Link href="/edit" className="store-cta">
            책 만들러 가기
          </Link>
        </div>
      ) : (
        <>
          {home.notices.length > 0 && (
            <NoticeBoard notices={home.notices} onOpen={setNotice} />
          )}

          {home.banners.length > 0 && <BannerStrip banners={home.banners} />}

          {home.featured.length > 0 && (
            <FeaturedRow
              featured={home.featured}
              openingId={opening}
              onOpen={(b) => void open(b)}
              onPreview={setPreview}
            />
          )}

          {home.shelves.map((s) => (
            <Shelf
              key={s.category}
              shelf={s}
              openingId={opening}
              onOpen={(b) => void open(b)}
              onPreview={setPreview}
            />
          ))}

          <div className="store-home-foot">
            <Link href="/store/all" className="store-cta">
              <Grid3x3 size={16} /> 전체 책 보기
            </Link>
          </div>
        </>
      )}

      {notice && <NoticeModal notice={notice} onClose={() => setNotice(null)} />}

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
          onLikeChange={(likeCount) => onLikeChange(preview.id, likeCount)}
        />
      )}
    </main>
  );
}

/* ---------- 공지·소식 ---------- */

function NoticeBoard({
  notices,
  onOpen,
}: {
  notices: StoreNotice[];
  onOpen: (n: StoreNotice) => void;
}) {
  return (
    <section className="store-notice" aria-label="공지사항">
      <div className="store-notice__head">
        <Megaphone size={15} /> 소식
      </div>
      <ul className="store-notice__list">
        {notices.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              className="store-notice__row"
              onClick={() => onOpen(n)}
            >
              <span className="store-notice__title">
                {n.pinned && <Pin size={12} className="store-notice__pin" />}
                {n.title}
              </span>
              <span className="store-notice__date">
                {new Date(n.createdAt).toLocaleDateString("ko-KR")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NoticeModal({
  notice,
  onClose,
}: {
  notice: StoreNotice;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={notice.title}
      onClick={onClose}
    >
      <div className="store-notice-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="preview-close"
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={18} />
        </button>
        <h2 className="store-notice-modal__title">
          {notice.pinned && <Pin size={15} className="store-notice__pin" />}
          {notice.title}
        </h2>
        <div className="store-notice-modal__date">
          {new Date(notice.createdAt).toLocaleDateString("ko-KR")}
        </div>
        {/* body 는 plain text — pre-wrap 으로 줄바꿈만 살린다 (HTML 렌더 안 함) */}
        <div className="store-notice-modal__body">{notice.body}</div>
      </div>
    </div>
  );
}

/* ---------- 이벤트 배너 ---------- */

const BANNERS_PER_VIEW = 2;
const BOOKSTORE_BANNER_IMAGE = "/store-bookstore-banner.png";

function BannerStrip({ banners }: { banners: StoreBanner[] }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(banners.length / BANNERS_PER_VIEW);
  const visible = banners.slice(
    page * BANNERS_PER_VIEW,
    (page + 1) * BANNERS_PER_VIEW,
  );

  const body = (b: StoreBanner) => {
    const isBookstoreBanner = b.imageUrl === BOOKSTORE_BANNER_IMAGE;

    return (
      <>
        <img
          className="store-banner__img"
          src={b.imageUrl}
          alt={isBookstoreBanner ? "북스토어 추천 배너" : "이벤트 배너"}
        />
        {isBookstoreBanner && (
          <span className="store-banner-copy" aria-hidden="true">
            <span className="store-banner-copy__eyebrow">TB Book Store</span>
            <span className="store-banner-copy__title">새로운 그림책을 만나보세요</span>
            <span className="store-banner-copy__body">아이와 함께 읽기 좋은 이야기 모음</span>
          </span>
        )}
      </>
    );
  };

  return (
    <section className="store-banners-wrap" aria-label="이벤트">
      <div className={`store-banners${visible.length === 1 ? " store-banners--single" : ""}`}>
        {visible.map((b) =>
          b.linkUrl ? (
            b.linkUrl.startsWith("/") ? (
              <Link key={b.id} href={b.linkUrl} className="store-banner">
                {body(b)}
              </Link>
            ) : (
              <a
                key={b.id}
                href={b.linkUrl}
                className="store-banner"
                target="_blank"
                rel="noopener noreferrer"
              >
                {body(b)}
              </a>
            )
          ) : (
            <div key={b.id} className="store-banner">
              {body(b)}
            </div>
          ),
        )}
      </div>
      {pageCount > 1 && (
        <>
          <button
            type="button"
            className="store-banners__nav store-banners__nav--prev"
            onClick={() => setPage((p) => (p - 1 + pageCount) % pageCount)}
            aria-label="이전 배너"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="store-banners__nav store-banners__nav--next"
            onClick={() => setPage((p) => (p + 1) % pageCount)}
            aria-label="다음 배너"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}
    </section>
  );
}

/* ---------- 금주의 추천 ---------- */

function FeaturedRow({
  featured,
  openingId,
  onOpen,
  onPreview,
}: {
  featured: FeaturedBook[];
  openingId: string | null;
  onOpen: (b: StoreBook) => void;
  onPreview: (b: StoreBook) => void;
}) {
  return (
    <section className="store-section" aria-label="금주의 추천">
      <div className="store-shelf__head">
        <h2 className="store-shelf__title">
          <Sparkles size={17} /> 금주의 추천
        </h2>
      </div>
      <div className="store-featured">
        {featured.map((b) => (
          <article key={b.id} className="store-featured-card">
            <span className="store-featured-card__ribbon">금주의 추천</span>
            <button
              type="button"
              className="store-featured-card__coverbtn"
              onClick={() => onOpen(b)}
              disabled={openingId !== null}
            >
              <div className="store-featured-card__cover">
                {b.coverThumb ? (
                  <img src={b.coverThumb} alt={b.title} loading="lazy" decoding="async" />
                ) : (
                  <span>표지</span>
                )}
                {openingId === b.id && (
                  <span className="store-card__loading">여는 중…</span>
                )}
              </div>
            </button>
            <div className="store-featured-card__info">
              <div className="store-featured-card__title">{b.title}</div>
              <Link
                href={`/author/${b.ownerId}`}
                className="store-card__authorlink"
              >
                {b.author ?? b.ownerName}
              </Link>
              <p className="store-featured-card__note">
                {b.featuredNote || b.description || "이번 주에 함께 읽고 싶은 책이에요."}
              </p>
              <button
                type="button"
                className="store-card__preview"
                onClick={() => onPreview(b)}
              >
                미리보기
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------- 카테고리별 신간 선반 ---------- */

function Shelf({
  shelf,
  openingId,
  onOpen,
  onPreview,
}: {
  shelf: StoreShelf;
  openingId: string | null;
  onOpen: (b: StoreBook) => void;
  onPreview: (b: StoreBook) => void;
}) {
  return (
    <section className="store-section" aria-label={`${shelf.category} 신간`}>
      <div className="store-shelf__head">
        <h2 className="store-shelf__title">
          {shelf.category} <span className="store-shelf__count">{shelf.total}권</span>
        </h2>
        <Link
          href={`/store/all?cat=${encodeURIComponent(shelf.category)}`}
          className="store-shelf__more"
        >
          더보기 <ChevronRight size={15} />
        </Link>
      </div>
      <div className="store-shelf__row">
        {shelf.books.map((b) => (
          <StoreBookCard
            key={b.id}
            book={b}
            openingId={openingId}
            onOpen={onOpen}
            onPreview={onPreview}
          />
        ))}
      </div>
    </section>
  );
}
