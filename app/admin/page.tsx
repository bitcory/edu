"use client";

import Link from "next/link";
import { Check, Eye, Pencil, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import BookViewer from "../components/BookViewer";
import BookInfoModal, { type InfoValues } from "../components/BookInfoModal";
import UserChip from "../components/auth/UserChip";
import { useIsAdmin } from "../components/auth/useIsAdmin";
import {
  approveBook,
  listPendingBooks,
  listRejectedBooks,
  listStoreBooks,
  rejectBook,
  updateBookInfo,
  type StoreBook,
} from "../lib/store";
import { approveAuthor, fetchAuthors, rejectAuthor } from "../lib/author-store";
import type { Author, AuthorStatus } from "../lib/author-types";
import { openBookForReading } from "../lib/render-book";
import { type RenderedPage } from "../lib/pdf-to-images";
import { formatPrice } from "../lib/format-price";

type Reader = { pages: RenderedPage[]; revoke: () => void; single: boolean };
type Section = "books" | "authors";
type Tab = "pending" | "approved" | "rejected";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "대기" },
  { key: "approved", label: "공개중" },
  { key: "rejected", label: "거절됨" },
];

const FETCHERS: Record<Tab, () => Promise<StoreBook[]>> = {
  pending: listPendingBooks,
  approved: listStoreBooks,
  rejected: listRejectedBooks,
};

const EMPTY: Record<Tab, string> = {
  pending: "승인 대기 중인 책이 없어요.",
  approved: "공개 중인 책이 없어요.",
  rejected: "거절된 책이 없어요.",
};

export default function AdminPage() {
  const { isAdmin } = useIsAdmin();
  const [section, setSection] = useState<Section>("books");
  const [tab, setTab] = useState<Tab>("pending");
  const [authorTab, setAuthorTab] = useState<AuthorStatus>("pending");
  const [books, setBooks] = useState<StoreBook[] | null>(null);
  const [authors, setAuthors] = useState<Author[] | null>(null);
  const [reader, setReader] = useState<Reader | null>(null);
  const [busy, setBusy] = useState(false);
  const [editInfo, setEditInfo] = useState<StoreBook | null>(null);

  const refresh = useCallback(() => {
    if (section === "books") {
      setBooks(null);
      FETCHERS[tab]().then(setBooks);
    } else {
      setAuthors(null);
      fetchAuthors(authorTab).then(setAuthors);
    }
  }, [section, tab, authorTab]);
  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin, refresh]);

  const approveAuthorApp = useCallback(
    async (userId: string) => {
      setBusy(true);
      await approveAuthor(userId);
      refresh();
      setBusy(false);
    },
    [refresh],
  );

  const rejectAuthorApp = useCallback(
    async (userId: string) => {
      const reason = window.prompt("거절 사유 (선택)", "");
      if (reason === null) return;
      setBusy(true);
      await rejectAuthor(userId, reason);
      refresh();
      setBusy(false);
    },
    [refresh],
  );

  useEffect(() => {
    return () => {
      reader?.revoke();
    };
  }, [reader]);

  const preview = useCallback(async (book: StoreBook) => {
    setBusy(true);
    try {
      const { rendered, revoke } = await openBookForReading(book);
      setReader({ pages: rendered, revoke, single: book.layout === "single" });
    } catch (err) {
      alert("책을 여는 중 문제가 생겼어요: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const approve = useCallback(
    async (id: string) => {
      setBusy(true);
      await approveBook(id);
      refresh();
      setBusy(false);
    },
    [refresh],
  );

  const reject = useCallback(
    async (id: string) => {
      const reason = window.prompt("거절 사유 (선택)", "");
      if (reason === null) return;
      setBusy(true);
      await rejectBook(id, reason);
      refresh();
      setBusy(false);
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

  if (!isAdmin) {
    return (
      <main className="store-shell">
        <header className="store-header">
          <Link href="/" className="home-btn" aria-label="처음으로" title="처음으로" />
          <h1 className="store-title">관리자</h1>
          <div className="store-header__right">
            <UserChip />
          </div>
        </header>
        <div className="store-empty">
          <p>관리자만 볼 수 있는 화면이에요.</p>
          <Link href="/" className="store-cta">
            처음으로
          </Link>
        </div>
      </main>
    );
  }

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
        <Link href="/" className="home-btn" aria-label="처음으로" title="처음으로" />
        <h1 className="store-title">관리자</h1>
        <div className="store-header__right">
          <UserChip />
        </div>
      </header>

      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab${section === "books" ? " is-active" : ""}`}
          onClick={() => setSection("books")}
        >
          책 승인
        </button>
        <button
          type="button"
          className={`admin-tab${section === "authors" ? " is-active" : ""}`}
          onClick={() => setSection("authors")}
        >
          작가 승인
        </button>
      </div>

      {section === "authors" ? (
        <AuthorsView
          tab={authorTab}
          setTab={setAuthorTab}
          authors={authors}
          busy={busy}
          onApprove={(id) => void approveAuthorApp(id)}
          onReject={(id) => void rejectAuthorApp(id)}
        />
      ) : (
        <BooksView
          tab={tab}
          setTab={setTab}
          books={books}
          busy={busy}
          onPreview={(b) => void preview(b)}
          onApprove={(id) => void approve(id)}
          onReject={(id) => void reject(id)}
          onEdit={(b) => setEditInfo(b)}
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
    </main>
  );
}

function BooksView({
  tab,
  setTab,
  books,
  busy,
  onPreview,
  onApprove,
  onReject,
  onEdit,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  books: StoreBook[] | null;
  busy: boolean;
  onPreview: (b: StoreBook) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (b: StoreBook) => void;
}) {
  return (
    <>
      <div className="admin-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`admin-tab${tab === t.key ? " is-active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {books === null ? (
        <p className="store-empty">불러오는 중…</p>
      ) : books.length === 0 ? (
        <div className="store-empty">
          <p>{EMPTY[tab]}</p>
        </div>
      ) : (
        <ul className="admin-list">
          {books.map((b) => (
            <li key={b.id} className="admin-row">
              <div className="admin-row__cover">
                {b.coverThumb ? (
                  <img src={b.coverThumb} alt={b.title} />
                ) : (
                  <span>표지</span>
                )}
              </div>
              <div className="admin-row__meta">
                <div className="admin-row__title">{b.title}</div>
                <div className="admin-row__author">
                  {b.author ?? b.ownerName} · {b.pages.length}쪽 ·{" "}
                  <strong>{formatPrice(b.price)}</strong>
                </div>
                {b.description && (
                  <div className="admin-row__desc">{b.description}</div>
                )}
                {tab === "rejected" && b.rejectReason && (
                  <div className="admin-row__reason">사유: {b.rejectReason}</div>
                )}
              </div>
              <div className="admin-row__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--preview"
                  onClick={() => onPreview(b)}
                  disabled={busy}
                >
                  <Eye size={16} /> 미리보기
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--preview"
                  onClick={() => onEdit(b)}
                  disabled={busy}
                  title="제목·지은이·가격·설명 수정"
                >
                  <Pencil size={16} /> 정보 수정
                </button>

                {tab === "pending" && (
                  <>
                    <button
                      type="button"
                      className="admin-btn admin-btn--approve"
                      onClick={() => onApprove(b.id)}
                      disabled={busy}
                    >
                      <Check size={16} /> 승인
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn--reject"
                      onClick={() => onReject(b.id)}
                      disabled={busy}
                    >
                      <X size={16} /> 거절
                    </button>
                  </>
                )}

                {tab === "approved" && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--reject"
                    onClick={() => onReject(b.id)}
                    disabled={busy}
                    title="공개를 취소하고 비공개로 돌립니다"
                  >
                    <X size={16} /> 공개 취소
                  </button>
                )}

                {tab === "rejected" && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--approve"
                    onClick={() => onApprove(b.id)}
                    disabled={busy}
                    title="다시 공개합니다"
                  >
                    <RotateCcw size={16} /> 다시 공개
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const AUTHOR_TABS: { key: AuthorStatus; label: string }[] = [
  { key: "pending", label: "대기" },
  { key: "approved", label: "승인" },
  { key: "rejected", label: "거절" },
];

const AUTHOR_EMPTY: Record<AuthorStatus, string> = {
  pending: "승인 대기 중인 작가가 없어요.",
  approved: "승인된 작가가 없어요.",
  rejected: "거절된 작가가 없어요.",
};

function AuthorsView({
  tab,
  setTab,
  authors,
  busy,
  onApprove,
  onReject,
}: {
  tab: AuthorStatus;
  setTab: (t: AuthorStatus) => void;
  authors: Author[] | null;
  busy: boolean;
  onApprove: (userId: string) => void;
  onReject: (userId: string) => void;
}) {
  return (
    <>
      <div className="admin-tabs">
        {AUTHOR_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`admin-tab${tab === t.key ? " is-active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {authors === null ? (
        <p className="store-empty">불러오는 중…</p>
      ) : authors.length === 0 ? (
        <div className="store-empty">
          <p>{AUTHOR_EMPTY[tab]}</p>
        </div>
      ) : (
        <ul className="admin-list">
          {authors.map((a) => (
            <li key={a.userId} className="admin-row admin-row--author">
              <div className="admin-row__meta">
                <div className="admin-row__title">
                  {a.displayName}
                  <span className="author-type-tag">
                    {a.type === "business" ? "개인사업자" : "개인"}
                  </span>
                </div>
                <div className="admin-row__author">
                  {a.businessName ? `${a.businessName} · ` : ""}
                  {a.email ?? "이메일 없음"}
                </div>
                {a.intro && <div className="admin-row__desc">{a.intro}</div>}

                {a.consentPII ? (
                  <div className="payout-info">
                    {a.type === "business" && a.bizNo && (
                      <span>사업자번호 {a.bizNo}</span>
                    )}
                    {a.type === "individual" && a.rrn && (
                      <span>주민번호 {a.rrn}</span>
                    )}
                    {(a.bankName || a.bankAccount) && (
                      <span>
                        {a.bankName ?? ""} {a.bankAccount ?? ""}
                        {a.accountHolder ? ` (${a.accountHolder})` : ""}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="payout-info payout-info--none">
                    정산 정보 미제출
                  </div>
                )}

                {a.status === "rejected" && a.rejectReason && (
                  <div className="admin-row__reason">사유: {a.rejectReason}</div>
                )}
              </div>
              <div className="admin-row__actions">
                {tab !== "approved" && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--approve"
                    onClick={() => onApprove(a.userId)}
                    disabled={busy}
                  >
                    <Check size={16} /> 승인
                  </button>
                )}
                {tab !== "rejected" && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--reject"
                    onClick={() => onReject(a.userId)}
                    disabled={busy}
                  >
                    <X size={16} /> {tab === "approved" ? "승인 취소" : "거절"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
