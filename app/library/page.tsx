"use client";

import Link from "next/link";
import {
  BookOpen,
  Lock,
  Mic,
  Music,
  Pencil,
  Store,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import BookViewer from "../components/BookViewer";
import UserChip from "../components/auth/UserChip";
import SubmitBookModal, {
  type SubmitValues,
} from "../components/SubmitBookModal";
import AuthorRegisterModal from "../components/AuthorRegisterModal";
import BookInfoModal, { type InfoValues } from "../components/BookInfoModal";
import BgmPoolModal from "../components/BgmPoolModal";
import DraftPickerModal from "../components/DraftPickerModal";
import NarrationModal from "../components/NarrationModal";
import {
  attachBookAudio,
  deleteBook,
  getBook,
  getBookAudioUrl,
  getNarrationUrls,
  listMyBooks,
  removeBookAudio,
  submitBook,
  updateBook,
  updateBookInfo,
  type BookStatus,
  type StoreBook,
} from "../lib/store";
import { applyAuthor, fetchMyAuthor } from "../lib/author-store";
import type { Author, AuthorApplyInput } from "../lib/author-types";
import { openBookForReading, renderCoverThumb } from "../lib/render-book";
import { pickRandomPoolBgm } from "../lib/bgm";
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
  webtoon: boolean;
  audioUrl?: string;
  narrationUrls?: (string | null)[];
};

export default function LibraryPage() {
  const { user } = useUser();
  const [books, setBooks] = useState<StoreBook[] | null>(null);
  const [reader, setReader] = useState<Reader | null>(null);
  const [busy, setBusy] = useState(false);
  // What to publish: either a selected cloud draft (convert in place via
  // draftId) or the localStorage working draft (new book, no draftId).
  const [publishTarget, setPublishTarget] = useState<{
    pages: EditorPage[];
    pageW: number;
    layout: StoreBook["layout"];
    draftId?: string;
    storyText?: string;
    initial: Partial<SubmitValues>;
  } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [author, setAuthor] = useState<Author | null | undefined>(undefined);
  const [authorOpen, setAuthorOpen] = useState(false);
  const [editInfo, setEditInfo] = useState<StoreBook | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const [audioTarget, setAudioTarget] = useState<StoreBook | null>(null);
  const [bgmOpen, setBgmOpen] = useState(false);
  const [narrTarget, setNarrTarget] = useState<StoreBook | null>(null);

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
    } catch (err) {
      alert("책을 여는 중 문제가 생겼어요: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  // Cloud drafts (임시저장) that can be published, newest first.
  const editorDrafts = (books ?? []).filter(
    (b) => b.status === "draft" && b.kind === "editor",
  );

  // Adopt a cloud draft as the publish target (converted in place on confirm).
  // The draft's pages live in R2 now, so hydrate the full snapshot first.
  const pickDraft = useCallback(
    async (d: StoreBook) => {
      setPickerOpen(false);
      setBusy(true);
      try {
        const full = (await getBook(d.id)) ?? d;
        // Keep a custom cover if one was set; otherwise render a crisp cover
        // from page 0. Never reuse its blurry 0.2× thumb as the cover.
        const cover =
          d.coverThumb ??
          (await renderCoverThumb(full.pages[0], full.pageW ?? 800));
        setPublishTarget({
          pages: full.pages,
          pageW: full.pageW ?? 800,
          layout: full.layout ?? "spread",
          draftId: d.id,
          storyText: full.storyText,
          initial: {
            title: d.title && d.title !== "제목 없는 책" ? d.title : undefined,
            author: d.author ?? author?.displayName,
            description: d.description,
            category: d.category,
            cover,
          },
        });
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [author],
  );

  const openSubmit = useCallback(async () => {
    if (author?.status !== "approved") {
      setAuthorOpen(true);
      return;
    }
    const drafts = (books ?? []).filter(
      (b) => b.status === "draft" && b.kind === "editor",
    );
    // Multiple works-in-progress → let the user pick which one to publish.
    if (drafts.length > 1) {
      setPickerOpen(true);
      return;
    }
    if (drafts.length === 1) {
      void pickDraft(drafts[0]);
      return;
    }
    // No cloud drafts → fall back to the current local working draft.
    const saved = await loadEditorState();
    if (!saved || saved.pages.length === 0) {
      alert("작업 중인 책이 없어요. 먼저 책을 만들어 주세요.");
      return;
    }
    // Render a crisp cover from page 0. Never fall back to its cached 0.2×
    // thumb — that bakes a blurry ~160px cover into the store. If the render
    // fails, ship no cover (the publish modal lets the author pick one).
    const cover = await renderCoverThumb(saved.pages[0], saved.pageW ?? 800);
    setPublishTarget({
      pages: saved.pages,
      pageW: saved.pageW ?? 800,
      layout: saved.layout ?? "spread",
      storyText: saved.storyText,
      initial: { author: author?.displayName, cover },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author, books]);

  const confirmAuthorApply = useCallback(async (input: AuthorApplyInput) => {
    setBusy(true);
    try {
      const oldName =
        author?.displayName ||
        user?.firstName ||
        user?.username ||
        user?.fullName ||
        user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
        "";
      if (user && input.displayName) {
        await user.update({ firstName: input.displayName, lastName: "" });
        await user.reload();
      }
      const a = await applyAuthor(input);
      const rename = await fetch("/api/me/rename", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ oldName, newName: input.displayName }),
      });
      if (!rename.ok) throw new Error("기존 책의 작가명 갱신에 실패했어요.");
      setAuthor(a);
      await listMyBooks().then(setBooks);
      alert(a.status === "approved" ? "작가 정보를 수정했어요." : "작가 등록을 신청했어요. 관리자 승인 후 책을 올릴 수 있어요.");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
      setAuthorOpen(false);
    }
  }, [author, user]);

  const confirmSubmit = useCallback(
    async (values: SubmitValues) => {
      if (!publishTarget) return;
      setBusy(true);
      try {
        if (publishTarget.draftId) {
          // Convert the selected cloud draft into a published book in place
          // (same id — no empty duplicate).
          await updateBook(publishTarget.draftId, {
            pages: publishTarget.pages,
            title: values.title,
            author: values.author,
            description: values.description,
            category: values.category,
            price: values.price,
            pageW: publishTarget.pageW,
            layout: publishTarget.layout,
            coverThumb: values.cover,
            storyText: publishTarget.storyText,
          });
        } else {
          await submitBook({
            title: values.title,
            author: values.author,
            description: values.description,
            category: values.category,
            price: values.price,
            pageW: publishTarget.pageW,
            layout: publishTarget.layout,
            pages: publishTarget.pages,
            coverThumb: values.cover,
            storyText: publishTarget.storyText,
          });
        }
        alert("북스토어에 올렸어요!");
        refresh();
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setBusy(false);
        setPublishTarget(null);
      }
    },
    [publishTarget, refresh],
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

  return (
    <main className="store-shell">
      <header className="store-header">
        <Link href="/" className="home-btn" aria-label="처음으로" title="처음으로" />
        <h1 className="store-title">내 서재</h1>
        <div className="store-header__right">
          <Link href="/edit" className="store-navlink">
            <Pencil size={16} /> 책만들기
          </Link>
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
          {isApproved ? "정식출판" : "작가 등록하고 올리기"}
        </button>
        <Link href="/edit" className="store-navlink">
          <Pencil size={16} /> 새 책 만들기
        </Link>
        <button
          type="button"
          className="store-navlink"
          onClick={() => setBgmOpen(true)}
        >
          <Music size={16} /> 공용 배경음악
        </button>
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
                      title="수정 (책 만들기에서 열기)"
                      aria-label="수정"
                    >
                      <Pencil size={14} /> 수정
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
                  {b.kind === "editor" && (
                    <button
                      type="button"
                      className="icon-btn icon-btn--narr"
                      onClick={() => setNarrTarget(b)}
                      disabled={busy}
                      title="페이지별 나레이션(음성) 넣기"
                      aria-label="나레이션"
                    >
                      <Mic size={16} />
                    </button>
                  )}
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

      {pickerOpen && (
        <DraftPickerModal
          drafts={editorDrafts}
          onPick={pickDraft}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {publishTarget && (
        <SubmitBookModal
          submitting={busy}
          authorType={author?.type}
          initial={publishTarget.initial}
          onCancel={() => setPublishTarget(null)}
          onConfirm={(values) => void confirmSubmit(values)}
        />
      )}

      {bgmOpen && <BgmPoolModal onClose={() => setBgmOpen(false)} />}

      {narrTarget && (
        <NarrationModal
          bookId={narrTarget.id}
          onClose={() => setNarrTarget(null)}
        />
      )}

      {editInfo && (
        <BookInfoModal
          initial={{
            title: editInfo.title,
            author: editInfo.author ?? "",
            price: editInfo.price,
            description: editInfo.description ?? "",
            category: editInfo.category ?? "",
            cover: editInfo.coverThumb,
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
                  avatarDataUrl: author.avatarUrl,
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
        <span className="author-banner__identity">
          <span className="author-banner__avatar" aria-hidden>
            {author.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={author.avatarUrl} alt="" />
            ) : (
              author.displayName.slice(0, 1)
            )}
          </span>
          <span>
            승인된 작가 ✓ {author.displayName}
            {author.type === "business" ? " · 개인사업자" : " · 개인"}
          </span>
        </span>
        <button type="button" className="author-banner__btn" onClick={onRegister}>
          작가 정보 수정
        </button>
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
