"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, Eye, Heart } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import BookViewer from "../../components/BookViewer";
import BookPreviewModal from "../../components/BookPreviewModal";
import UserChip from "../../components/auth/UserChip";
import { fetchAuthorProfile } from "../../lib/author-store";
import {
  getBookAudioUrl,
  getNarrationUrls,
  type StoreBook,
} from "../../lib/store";
import type { PublicAuthor } from "../../lib/author-types";
import { openBookForReading } from "../../lib/render-book";
import { type RenderedPage } from "../../lib/pdf-to-images";
import { formatPrice } from "../../lib/format-price";
import { pickRandomPoolBgm } from "../../lib/bgm";

type Reader = {
  pages: RenderedPage[];
  revoke: () => void;
  single: boolean;
  webtoon: boolean;
  audioUrl?: string;
  narrationUrls?: (string | null)[];
};

export default function AuthorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  // undefined = loading, null = not found / not an approved author.
  const [author, setAuthor] = useState<PublicAuthor | null | undefined>(
    undefined,
  );
  const [books, setBooks] = useState<StoreBook[]>([]);
  const [sort, setSort] = useState<"likes" | "recent">("likes");
  const [reader, setReader] = useState<Reader | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [preview, setPreview] = useState<StoreBook | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAuthorProfile(id).then((res) => {
      if (cancelled) return;
      if (!res) {
        setAuthor(null);
        setBooks([]);
        return;
      }
      setAuthor(res.author);
      setBooks(res.books);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    return () => reader?.revoke();
  }, [reader]);

  // Server returns books most-liked first; re-sort client-side for the toggle.
  const sorted = useMemo(() => {
    const arr = [...books];
    if (sort === "recent") {
      arr.sort(
        (a, b) =>
          (b.reviewedAt ?? b.submittedAt) - (a.reviewedAt ?? a.submittedAt),
      );
    } else {
      arr.sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0));
    }
    return arr;
  }, [books, sort]);

  const totalLikes = useMemo(
    () => books.reduce((s, b) => s + (b.likeCount ?? 0), 0),
    [books],
  );

  const open = useCallback(async (book: StoreBook) => {
    setOpening(book.id);
    try {
      const { rendered, revoke } = await openBookForReading(book);
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
        <Link
          href="/"
          className="home-btn"
          aria-label="처음으로"
          title="처음으로"
        />
        <h1 className="store-title">작가 소개</h1>
        <div className="store-header__right">
          <Link href="/store" className="store-navlink">
            <BookOpen size={16} /> 북스토어
          </Link>
          <UserChip />
        </div>
      </header>

      <Link href="/store" className="author-back">
        <ArrowLeft size={16} /> 북스토어로 돌아가기
      </Link>

      {author === undefined && <p className="store-empty">불러오는 중…</p>}
      {author === null && (
        <div className="store-empty">작가를 찾을 수 없어요.</div>
      )}

      {author && (
        <>
          <section className="author-hero">
            <div className="author-hero__avatar" aria-hidden>
              {author.avatarUrl ? (
                <img src={author.avatarUrl} alt="" />
              ) : (
                author.displayName.slice(0, 1)
              )}
            </div>
            <div className="author-hero__info">
              <h2 className="author-hero__name">
                {author.displayName}
                {author.type === "business" && author.businessName && (
                  <span className="author-hero__biz">
                    {author.businessName}
                  </span>
                )}
              </h2>
              {author.intro && (
                <p className="author-hero__intro">{author.intro}</p>
              )}
              <div className="author-hero__stats">
                <span>
                  책 <b>{books.length}</b>권
                </span>
                <span className="author-hero__likes">
                  <Heart size={14} fill="currentColor" /> <b>{totalLikes}</b>
                </span>
              </div>
            </div>
          </section>

          {books.length > 0 && (
            <div className="author-sort" role="tablist" aria-label="정렬">
              <button
                type="button"
                role="tab"
                aria-selected={sort === "likes"}
                className={sort === "likes" ? "is-active" : ""}
                onClick={() => setSort("likes")}
              >
                인기순
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sort === "recent"}
                className={sort === "recent" ? "is-active" : ""}
                onClick={() => setSort("recent")}
              >
                최신순
              </button>
            </div>
          )}

          {books.length === 0 ? (
            <div className="store-empty">아직 공개한 책이 없어요.</div>
          ) : (
            <div className="store-grid">
              {sorted.map((b) => (
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
                  <div className="store-card__author">
                    {b.author ?? b.ownerName}
                    {b.category && (
                      <span className="store-card__cat">{b.category}</span>
                    )}
                  </div>
                  <div className="store-card__meta">
                    <span className="store-card__price">
                      {formatPrice(b.price)}
                    </span>
                    <span className="store-card__likes">
                      <Heart size={14} fill="currentColor" />{" "}
                      {b.likeCount ?? 0}
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
        </>
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
