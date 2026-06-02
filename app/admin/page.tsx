"use client";

import Link from "next/link";
import {
  BookOpen,
  Check,
  Eye,
  Pencil,
  PencilRuler,
  RefreshCw,
  RotateCcw,
  Store,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import BookViewer from "../components/BookViewer";
import BookInfoModal, { type InfoValues } from "../components/BookInfoModal";
import UserChip from "../components/auth/UserChip";
import { useIsAdmin } from "../components/auth/useIsAdmin";
import {
  approveBook,
  getBook,
  getBookAudioUrl,
  getNarrationUrls,
  listDraftBooks,
  listPendingBooks,
  listRejectedBooks,
  listStoreBooks,
  rejectBook,
  updateBookInfo,
  type StoreBook,
} from "../lib/store";
import { approveAuthor, fetchAuthors, rejectAuthor } from "../lib/author-store";
import type { Author, AuthorStatus } from "../lib/author-types";
import { openBookForReading, renderCoverThumb } from "../lib/render-book";
import { type RenderedPage } from "../lib/pdf-to-images";
import { formatPrice } from "../lib/format-price";
import { pickRandomPoolBgm } from "../lib/bgm";

type Reader = {
  pages: RenderedPage[];
  revoke: () => void;
  single: boolean;
  audioUrl?: string;
  narrationUrls?: (string | null)[];
};
type Section = "books" | "authors";
type Tab = "pending" | "approved" | "rejected" | "drafts";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "대기" },
  { key: "approved", label: "공개중" },
  { key: "drafts", label: "임시저장" },
  { key: "rejected", label: "거절됨" },
];

const FETCHERS: Record<Tab, () => Promise<StoreBook[]>> = {
  pending: listPendingBooks,
  approved: listStoreBooks,
  drafts: listDraftBooks,
  rejected: listRejectedBooks,
};

const EMPTY: Record<Tab, string> = {
  pending: "승인 대기 중인 책이 없어요.",
  approved: "공개 중인 책이 없어요.",
  drafts: "임시저장 중인 책이 없어요.",
  rejected: "거절된 책이 없어요.",
};

/** Natural pixel width of a data-URL image (0 on failure) — used to tell an
 *  already-crisp cover from an old blurry 0.2× (≈160px) thumb. */
function imageWidth(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth || 0);
    img.onerror = () => resolve(0);
    img.src = dataUrl;
  });
}
// Covers at/above this width are treated as already high-res (skip re-render).
const HIRES_MIN_WIDTH = 400;

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

  // Bulk-regenerate selected books' covers from page 0 at high resolution.
  // Admins may do this for any owner; coverThumb-only update keeps the book's
  // status (no re-approval). Books already high-res are skipped automatically.
  const refreshCovers = useCallback(
    async (selected: StoreBook[]) => {
      if (selected.length === 0) {
        alert("선택한 책이 없어요.");
        return;
      }
      setBusy(true);
      let updated = 0;
      let skipped = 0;
      let fail = 0;
      try {
        for (const b of selected) {
          try {
            // Only editor books have an editable page 0 to render a cover from.
            if (b.kind !== "editor") {
              skipped += 1;
              continue;
            }
            // Already crisp? skip without refetching the full snapshot.
            if (
              b.coverThumb &&
              (await imageWidth(b.coverThumb)) >= HIRES_MIN_WIDTH
            ) {
              skipped += 1;
              continue;
            }
            const full = (await getBook(b.id)) ?? b;
            const cover = await renderCoverThumb(
              full.pages[0],
              full.pageW ?? 800,
            );
            if (!cover) {
              fail += 1;
              continue;
            }
            await updateBookInfo(b.id, { cover });
            updated += 1;
          } catch (err) {
            console.error("표지 갱신 실패", b.id, err);
            fail += 1;
          }
        }
        refresh();
        alert(
          `표지 ${updated}권 갱신, 이미 고화질 ${skipped}권 건너뜀${
            fail ? `, ${fail}권 실패` : ""
          }.`,
        );
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

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
      let audioUrl = book.audioKey
        ? ((await getBookAudioUrl(book.id)) ?? undefined)
        : undefined;
      if (!audioUrl) audioUrl = await pickRandomPoolBgm();
      const nUrls = await getNarrationUrls(book.id);
      setReader({
        pages: rendered,
        revoke,
        single: book.layout === "single",
        audioUrl,
        narrationUrls: nUrls.some(Boolean) ? nUrls : undefined,
      });
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
        <h1 className="store-title">관리자</h1>
        <div className="store-header__right">
          <Link href="/library" className="store-navlink">
            <BookOpen size={16} /> 내 서재
          </Link>
          <Link href="/store" className="store-navlink">
            <Store size={16} /> 북스토어
          </Link>
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
          onRefreshCovers={(sel) => void refreshCovers(sel)}
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
  onRefreshCovers,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  books: StoreBook[] | null;
  busy: boolean;
  onPreview: (b: StoreBook) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (b: StoreBook) => void;
  onRefreshCovers: (selected: StoreBook[]) => void;
}) {
  // Cover-refresh selection (editor books only — PDFs have no page 0 to render).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => setSelected(new Set()), [tab, books]);
  const selectableIds = (books ?? [])
    .filter((b) => b.kind === "editor")
    .map((b) => b.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

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

      {selectableIds.length > 0 && (
        <div
          style={{
            margin: "0 0 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            padding: "8px 12px",
            borderRadius: 12,
            background: "rgba(255, 255, 255, 0.55)",
            boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.05)",
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 700,
              fontSize: 13,
              color: "#6a4a2b",
            }}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) =>
                setSelected(e.target.checked ? new Set(selectableIds) : new Set())
              }
            />
            전체 선택
          </label>
          <span style={{ color: "#b09a78", fontSize: 12 }}>
            {selected.size > 0 ? `${selected.size}권 선택됨` : "표지를 다시 뽑을 책을 고르세요"}
          </span>
          <button
            type="button"
            className="admin-btn admin-btn--preview"
            style={{ marginLeft: "auto" }}
            disabled={busy || selected.size === 0}
            onClick={() =>
              onRefreshCovers(
                (books ?? []).filter((b) => selected.has(b.id)),
              )
            }
            title="선택한 책 표지를 0쪽에서 고화질로 다시 만듭니다 (이미 고화질인 건 건너뜀, 공개 상태 유지)"
          >
            <RefreshCw size={16} /> 표지 갱신
          </button>
        </div>
      )}

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
              {b.kind === "editor" && (
                <input
                  type="checkbox"
                  checked={selected.has(b.id)}
                  onChange={(e) => toggle(b.id, e.target.checked)}
                  title="표지 갱신 대상으로 선택"
                  style={{ alignSelf: "center", marginRight: 4 }}
                />
              )}
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
                  {b.author ?? b.ownerName}
                  {(() => {
                    const n = b.pageCount ?? b.pages.length;
                    return n > 0 ? ` · ${n}쪽` : "";
                  })()}{" "}
                  · <strong>{formatPrice(b.price)}</strong>
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
                {b.kind === "editor" && (
                  <Link
                    href={`/edit?book=${b.id}`}
                    className="admin-btn admin-btn--preview"
                    title="책 만들기에서 내용까지 편집 (관리자 권한)"
                  >
                    <PencilRuler size={16} /> 책 편집
                  </Link>
                )}

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

                {tab === "drafts" && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--approve"
                    onClick={() => onApprove(b.id)}
                    disabled={busy}
                    title="이 임시저장 책을 북스토어에 바로 출품(공개)합니다"
                  >
                    <Check size={16} /> 출품
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
