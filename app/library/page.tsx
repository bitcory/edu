"use client";

import Link from "next/link";
import {
  BookOpen,
  Lock,
  Music,
  Pencil,
  Store,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import BookViewer from "../components/BookViewer";
import UserChip from "../components/auth/UserChip";
import SubmitBookModal, {
  type SubmitValues,
} from "../components/SubmitBookModal";
import AuthorRegisterModal from "../components/AuthorRegisterModal";
import BookInfoModal, { type InfoValues } from "../components/BookInfoModal";
import {
  attachBookAudio,
  deleteBook,
  getBookAudioUrl,
  listMyBooks,
  removeBookAudio,
  submitBook,
  updateBookInfo,
  type BookStatus,
  type StoreBook,
} from "../lib/store";
import { applyAuthor, fetchMyAuthor } from "../lib/author-store";
import type { Author, AuthorApplyInput } from "../lib/author-types";
import { openBookForReading } from "../lib/render-book";
import { type RenderedPage } from "../lib/pdf-to-images";
import { loadEditorState } from "../lib/editor-storage";
import { formatPrice } from "../lib/format-price";
import type { EditorPage } from "../lib/editor-types";

const STATUS_LABEL: Record<BookStatus, string> = {
  draft: "비공개",
  pending: "승인 대기",
  approved: "공개 중",
  rejected: "거절됨",
};

type Reader = {
  pages: RenderedPage[];
  revoke: () => void;
  single: boolean;
  audioUrl?: string;
};

export default function LibraryPage() {
  const [books, setBooks] = useState<StoreBook[] | null>(null);
  const [reader, setReader] = useState<Reader | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftPages, setDraftPages] = useState<EditorPage[] | null>(null);
  const [author, setAuthor] = useState<Author | null | undefined>(undefined);
  const [authorOpen, setAuthorOpen] = useState(false);
  const [editInfo, setEditInfo] = useState<StoreBook | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const [audioTarget, setAudioTarget] = useState<StoreBook | null>(null);

  const isApproved = author?.status === "approved";

  const refresh = useCallback(() => {
    listMyBooks().then(setBooks);
  }, []);
  useEffect(() => {
    refresh();
    fetchMyAuthor().then(setAuthor);
  }, [refresh]);

  // Background music: a book already with music asks remove-or-replace; an
  // empty one goes straight to the file picker.
  const onMusicClick = useCallback((b: StoreBook) => {
    if (b.audioKey) {
      const remove = window.confirm(
        "배경음악을 제거할까요?\n(취소를 누르면 다른 곡으로 교체할 수 있어요.)",
      );
      if (remove) {
        setBusy(true);
        removeBookAudio(b.id)
          .then(() => listMyBooks().then(setBooks))
          .catch((e) => alert((e as Error).message))
          .finally(() => setBusy(false));
        return;
      }
    }
    setAudioTarget(b);
    audioInputRef.current?.click();
  }, []);

  const onAudioPicked = useCallback(
    async (file: File) => {
      const target = audioTarget;
      if (!target) return;
      setBusy(true);
      try {
        await attachBookAudio(target.id, file);
        await listMyBooks().then(setBooks);
        alert("배경음악을 등록했어요! 책을 열면 잔잔하게 흘러나와요.");
      } catch (e) {
        alert((e as Error).message);
      } finally {
        setBusy(false);
        setAudioTarget(null);
      }
    },
    [audioTarget],
  );

  useEffect(() => {
    return () => {
      reader?.revoke();
    };
  }, [reader]);

  const removeBook = useCallback(
    async (book: StoreBook) => {
      if (
        !window.confirm(
          `"${book.title}"을(를) 삭제할까요? 되돌릴 수 없어요.`,
        )
      ) {
        return;
      }
      setBusy(true);
      try {
        await deleteBook(book.id);
        refresh();
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const saveInfo = useCallback(
    async (values: InfoValues) => {
      if (!editInfo) return;
      setBusy(true);
      try {
        await updateBookInfo(editInfo.id, values);
        refresh();
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setBusy(false);
        setEditInfo(null);
      }
    },
    [editInfo, refresh],
  );

  const readBook = useCallback(async (book: StoreBook) => {
    setBusy(true);
    try {
      const { rendered, revoke } = await openBookForReading(book);
      const audioUrl = book.audioKey
        ? ((await getBookAudioUrl(book.id)) ?? undefined)
        : undefined;
      setReader({
        pages: rendered,
        revoke,
        single: book.layout === "single",
        audioUrl,
      });
    } catch (err) {
      alert("책을 여는 중 문제가 생겼어요: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const openSubmit = useCallback(() => {
    if (author?.status !== "approved") {
      setAuthorOpen(true);
      return;
    }
    const saved = loadEditorState();
    if (!saved || saved.pages.length === 0) {
      alert("작업 중인 책이 없어요. 먼저 책을 만들어 주세요.");
      return;
    }
    setDraftPages(saved.pages);
  }, [author]);

  const confirmAuthorApply = useCallback(async (input: AuthorApplyInput) => {
    setBusy(true);
    try {
      const a = await applyAuthor(input);
      setAuthor(a);
      alert("작가 등록을 신청했어요. 관리자 승인 후 책을 올릴 수 있어요.");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
      setAuthorOpen(false);
    }
  }, []);

  const confirmSubmit = useCallback(
    async (values: SubmitValues) => {
      if (!draftPages) return;
      const saved = loadEditorState();
      setBusy(true);
      try {
        await submitBook({
          title: values.title,
          author: values.author,
          description: values.description,
          price: values.price,
          pageW: saved?.pageW ?? 800,
          layout: saved?.layout ?? "spread",
          pages: draftPages,
        });
        alert("북스토어에 올렸어요! 슈퍼관리자 승인 후 공개돼요.");
        refresh();
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setBusy(false);
        setDraftPages(null);
      }
    },
    [draftPages, refresh],
  );

  if (reader) {
    return (
      <BookViewer
        pages={reader.pages}
        singlePage={reader.single}
        audioUrl={reader.audioUrl}
        onClose={() => setReader(null)}
      />
    );
  }

  return (
    <main className="store-shell">
      <header className="store-header">
        <Link href="/" className="home-btn" aria-label="처음으로" title="처음으로" />
        <h1 className="store-title">내 서재</h1>
        <div className="store-header__right">
          <Link href="/store" className="store-navlink">
            <Store size={16} /> 북스토어
          </Link>
          <UserChip />
        </div>
      </header>

      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*,.mp3"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onAudioPicked(f);
          e.target.value = "";
        }}
      />

      <AuthorBanner author={author} onRegister={() => setAuthorOpen(true)} />

      <div className="library-actions">
        <button
          type="button"
          className="store-cta"
          onClick={openSubmit}
          disabled={busy}
        >
          <Upload size={16} />{" "}
          {isApproved ? "작업 중인 책 올리기" : "작가 등록하고 올리기"}
        </button>
        <Link href="/edit" className="store-navlink">
          <Pencil size={16} /> 새 책 만들기
        </Link>
      </div>

      {books === null ? (
        <p className="store-empty">불러오는 중…</p>
      ) : books.length === 0 ? (
        <div className="store-empty">
          <BookOpen size={40} strokeWidth={1.6} />
          <p>아직 올린 책이 없어요. 만든 책을 올려 보세요!</p>
        </div>
      ) : (
        <div className="store-grid">
          {books.map((b) => (
            <div key={b.id} className="store-card store-card--mine">
              <button
                type="button"
                className="store-card__coverbtn"
                onClick={() => void readBook(b)}
                disabled={busy}
              >
                <div className="store-card__cover">
                  {b.coverThumb ? (
                    <img src={b.coverThumb} alt={b.title} />
                  ) : (
                    <span>표지</span>
                  )}
                </div>
              </button>
              <div className="store-card__title">{b.title}</div>
              <div className="store-card__price">{formatPrice(b.price)}</div>
              <span className={`status-badge status-badge--${b.status}`}>
                {STATUS_LABEL[b.status]}
              </span>
              {b.status === "rejected" && b.rejectReason && (
                <p className="store-card__reason">사유: {b.rejectReason}</p>
              )}
              <div className="store-card__actions">
                <div className="store-card__tags">
                  {b.kind === "pdf" && (
                    <span className="store-card__tag">PDF</span>
                  )}
                  {b.kind === "editor" && b.status === "pending" && (
                    <span
                      className="store-card__locked"
                      title="승인 대기 중에는 수정할 수 없어요"
                    >
                      <Lock size={12} /> 수정 잠김
                    </span>
                  )}
                </div>
                <div className="store-card__btns">
                  {b.kind === "pdf" ? (
                    <button
                      type="button"
                      className="icon-btn icon-btn--edit"
                      onClick={() => setEditInfo(b)}
                      disabled={busy}
                      title="제목·가격 수정"
                      aria-label="정보 수정"
                    >
                      <Pencil size={16} />
                    </button>
                  ) : b.status === "draft" ? (
                    <Link
                      href={`/edit?book=${b.id}`}
                      className="lib-continue"
                      title="수정하기 (책 만들기에서 열기)"
                      aria-label="수정하기"
                    >
                      <Pencil size={14} /> 수정하기
                    </Link>
                  ) : (
                    b.status !== "pending" && (
                      <Link
                        href={`/edit?book=${b.id}`}
                        className="icon-btn icon-btn--edit"
                        title={
                          b.status === "approved"
                            ? "수정 (책 만들기에서 열기 · 다시 승인 필요)"
                            : "수정 (책 만들기에서 열기)"
                        }
                        aria-label="수정"
                      >
                        <Pencil size={16} />
                      </Link>
                    )
                  )}
                  <button
                    type="button"
                    className={`icon-btn icon-btn--music${
                      b.audioKey ? " is-on" : ""
                    }`}
                    onClick={() => onMusicClick(b)}
                    disabled={busy}
                    title={
                      b.audioKey
                        ? "배경음악 등록됨 (눌러서 교체/제거)"
                        : "배경음악 추가"
                    }
                    aria-label="배경음악"
                  >
                    <Music size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--delete"
                    onClick={() => void removeBook(b)}
                    disabled={busy}
                    title="삭제"
                    aria-label="삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {draftPages && (
        <SubmitBookModal
          submitting={busy}
          authorType={author?.type}
          initial={{ author: author?.displayName }}
          onCancel={() => setDraftPages(null)}
          onConfirm={(values) => void confirmSubmit(values)}
        />
      )}

      {editInfo && (
        <BookInfoModal
          initial={{
            title: editInfo.title,
            author: editInfo.author ?? "",
            price: editInfo.price,
            description: editInfo.description ?? "",
          }}
          submitting={busy}
          onCancel={() => setEditInfo(null)}
          onConfirm={(values) => void saveInfo(values)}
        />
      )}

      {authorOpen && (
        <AuthorRegisterModal
          initial={
            author
              ? {
                  type: author.type,
                  displayName: author.displayName,
                  businessName: author.businessName,
                  intro: author.intro,
                }
              : undefined
          }
          submitting={busy}
          onCancel={() => setAuthorOpen(false)}
          onConfirm={(input) => void confirmAuthorApply(input)}
        />
      )}
    </main>
  );
}

function AuthorBanner({
  author,
  onRegister,
}: {
  author: Author | null | undefined;
  onRegister: () => void;
}) {
  if (author === undefined) return null; // still loading
  if (author?.status === "approved") {
    return (
      <div className="author-banner author-banner--ok">
        <span>
          승인된 작가 ✓ {author.displayName}
          {author.type === "business" ? " · 개인사업자" : " · 개인"}
        </span>
      </div>
    );
  }
  if (author?.status === "pending") {
    return (
      <div className="author-banner author-banner--pending">
        <span>작가 승인 대기 중이에요. 승인되면 책을 올릴 수 있어요.</span>
      </div>
    );
  }
  return (
    <div className="author-banner">
      <span>
        {author?.status === "rejected"
          ? `작가 등록이 거절됐어요${author.rejectReason ? `: ${author.rejectReason}` : ""}.`
          : "작가로 등록하면 만든 책을 북스토어에 올릴 수 있어요."}
      </span>
      <button type="button" className="author-banner__btn" onClick={onRegister}>
        {author?.status === "rejected" ? "다시 신청" : "작가 등록"}
      </button>
    </div>
  );
}
