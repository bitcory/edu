"use client";

import Link from "next/link";
import {
  BookOpen, ChevronLeft, ChevronRight, Flame, Library, Search, Sparkles, Store,
  Users,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BookViewer from "../../components/BookViewer";
import BookPreviewModal from "../../components/BookPreviewModal";
import AuthorPickerModal from "../../components/AuthorPickerModal";
import StoreBookCard from "../../components/StoreBookCard";
import UserChip from "../../components/auth/UserChip";
import {
  getBookAudioUrl,
  getNarrationUrls,
  listStoreBooks,
  recordBookRead,
  type StoreBook,
} from "../../lib/store";
import { openBookForReading } from "../../lib/render-book";
import { type RenderedPage } from "../../lib/pdf-to-images";
import { BOOK_CATEGORIES } from "../../lib/categories";
import { pickRandomPoolBgm } from "../../lib/bgm";

type Reader = {
  pages: RenderedPage[];
  revoke: () => void;
  single: boolean;
  webtoon: boolean;
  audioUrl?: string;
  narrationUrls?: (string | null)[];
};

type Sort = "latest" | "popular";

/** 전체 책 목록 — 검색·정렬·카테고리·페이지네이션. 스토어 홈(/store)의 각
 * 섹션 "더보기"가 ?cat= 딥링크로 진입한다. */
function StoreAllPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [books, setBooks] = useState<StoreBook[] | null>(null);
  const [reader, setReader] = useState<Reader | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  // URL 쿼리로 초기화 (cat 은 실존 카테고리만 인정 — 불량 쿼리 방어)
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [cat, setCat] = useState<string | null>(() => {
    const c = params.get("cat");
    return c && (BOOK_CATEGORIES as readonly string[]).includes(c) ? c : null;
  });
  const [sort, setSort] = useState<Sort>(
    params.get("sort") === "popular" ? "popular" : "latest",
  );
  const [preview, setPreview] = useState<StoreBook | null>(null);
  const [authorPicker, setAuthorPicker] = useState(false);
  const PAGE_SIZE = 12;
  const [page, setPage] = useState(0);
  const gridTopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listStoreBooks().then(setBooks);
  }, []);

  // 필터 상태를 URL 에 반영 — 새로고침/공유해도 같은 화면.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (cat) sp.set("cat", cat);
    if (sort !== "latest") sp.set("sort", sort);
    if (query.trim()) sp.set("q", query.trim());
    const qs = sp.toString();
    router.replace(`/store/all${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [cat, sort, query, router]);

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

  // 검색어·카테고리·정렬이 바뀌면 1페이지로 복귀.
  useEffect(() => {
    setPage(0);
  }, [query, cat, sort]);

  const pageCount = filtered ? Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const visible = useMemo(
    () => (filtered ? filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE) : null),
    [filtered, safePage],
  );

  const goPage = useCallback((p: number) => {
    setPage(p);
    // 페이지를 넘기면 그리드 첫 줄이 보이게 스크롤 복귀.
    gridTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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
        <Link href="/store" className="store-back" title="북스토어 홈으로">
          <ChevronLeft size={17} /> 북스토어
        </Link>
        <h1 className="store-title">전체 책</h1>
        <div className="store-header__right">
          <Link href="/store" className="store-navlink">
            <Store size={16} /> 스토어 홈
          </Link>
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
        <div className="store-toolbar">
          <div className="store-sorts" role="tablist" aria-label="정렬">
            <button
              type="button"
              className={`store-sort${sort === "latest" ? " is-active" : ""}`}
              onClick={() => setSort("latest")}
            >
              <Sparkles size={14} /> 최신순
            </button>
            <button
              type="button"
              className={`store-sort${sort === "popular" ? " is-active" : ""}`}
              onClick={() => setSort("popular")}
              title="좋아요와 조회수가 많은 순"
            >
              <Flame size={14} /> 인기순
            </button>
          </div>
          <span className="store-count">
            {cat ? `‘${cat}’ ` : ""}공개된 책 <b>{filtered?.length ?? 0}</b>권
            {pageCount > 1 && (
              <span className="store-count__page"> · {safePage + 1}/{pageCount} 페이지</span>
            )}
          </span>
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
        <div className="store-grid" ref={gridTopRef}>
          {(visible ?? []).map((b) => (
            <StoreBookCard
              key={b.id}
              book={b}
              openingId={opening}
              onOpen={(x) => void open(x)}
              onPreview={setPreview}
            />
          ))}
        </div>
      )}

      {filtered && pageCount > 1 && (
        <nav className="store-pager" aria-label="페이지">
          <button
            type="button"
            className="store-pager__nav"
            disabled={safePage === 0}
            onClick={() => goPage(safePage - 1)}
            aria-label="이전 페이지"
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`store-pager__num${i === safePage ? " is-active" : ""}`}
              onClick={() => goPage(i)}
              aria-current={i === safePage ? "page" : undefined}
            >
              {i + 1}
            </button>
          ))}
          <button
            type="button"
            className="store-pager__nav"
            disabled={safePage === pageCount - 1}
            onClick={() => goPage(safePage + 1)}
            aria-label="다음 페이지"
          >
            <ChevronRight size={16} />
          </button>
        </nav>
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

// useSearchParams 는 Suspense 경계가 필요하다 (없으면 next build 실패).
export default function StoreAllPageWrapper() {
  return (
    <Suspense fallback={<p className="store-empty">불러오는 중…</p>}>
      <StoreAllPage />
    </Suspense>
  );
}
