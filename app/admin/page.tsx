"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  BookCheck,
  BookOpen,
  Ban,
  Check,
  CircleDollarSign,
  Clock3,
  Eye,
  FilePenLine,
  Globe2,
  Image as ImageIcon,
  KeyRound,
  Megaphone,
  Pencil,
  PencilRuler,
  Pin,
  RotateCcw,
  Star,
  Store,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useState, type CSSProperties } from "react";
import CredentialsPanel from "../components/CredentialsPanel";
import BookViewer from "../components/BookViewer";
import BookInfoModal, { type InfoValues } from "../components/BookInfoModal";
import UserChip from "../components/auth/UserChip";
import { useIsAdmin } from "../components/auth/useIsAdmin";
import {
  adminCreateBanner,
  adminCreateNotice,
  adminDeleteBanner,
  adminDeleteNotice,
  adminListBanners,
  adminListFeatured,
  adminListNotices,
  adminSetFeatured,
  adminUnsetFeatured,
  adminUpdateBanner,
  adminUpdateNotice,
  adminUploadBannerImage,
  approveBook,
  getBook,
  getBookAudioUrl,
  getNarrationUrls,
  getSettlement,
  listDraftBooks,
  listPendingBooks,
  listRejectedBooks,
  listStoreBooks,
  rejectBook,
  setAuthorShare,
  updateBookInfo,
  type AdminBanner,
  type FeaturedEntry,
  type Settlement,
  type StoreBook,
  type StoreNotice,
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
  webtoon: boolean;
  audioUrl?: string;
  narrationUrls?: (string | null)[];
};
type Section =
  | "books"
  | "authors"
  | "settlement"
  | "notices"
  | "banners"
  | "featured"
  | "keys";
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
    } else if (section === "authors") {
      setAuthors(null);
      fetchAuthors(authorTab).then(setAuthors);
    }
    // notices/banners/featured 뷰는 각자 fetch 를 소유한다.
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

  // 표지 화질개선: re-render the cover from page 0 at 560px and re-upload.
  // (Editor books only — PDF books have no Fabric page data.)
  const refreshCover = useCallback(
    async (b: StoreBook) => {
      if (b.kind !== "editor") {
        alert("표지 화질개선은 에디터로 만든 책만 지원해요 (PDF 책 제외).");
        return;
      }
      setBusy(true);
      try {
        const full = await getBook(b.id);
        const cover = await renderCoverThumb(full?.pages?.[0], full?.pageW ?? 800);
        if (!cover) {
          alert("표지를 렌더하지 못했어요 (표지 페이지 데이터가 없습니다).");
          return;
        }
        await updateBookInfo(b.id, { cover });
        refresh();
        alert("표지를 560px로 다시 생성했어요.");
      } catch (err) {
        alert("표지 화질개선 실패: " + ((err as Error)?.message || ""));
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

      <div className="admin-tabs admin-tabs--primary">
        <button
          type="button"
          className={`admin-tab${section === "books" ? " is-active" : ""}`}
          aria-pressed={section === "books"}
          onClick={() => setSection("books")}
        >
          <BookCheck size={16} aria-hidden="true" />
          책 승인
        </button>
        <button
          type="button"
          className={`admin-tab${section === "authors" ? " is-active" : ""}`}
          aria-pressed={section === "authors"}
          onClick={() => setSection("authors")}
        >
          <UserCheck size={16} aria-hidden="true" />
          작가 승인
        </button>
        <button
          type="button"
          className={`admin-tab${section === "settlement" ? " is-active" : ""}`}
          aria-pressed={section === "settlement"}
          onClick={() => setSection("settlement")}
        >
          <CircleDollarSign size={16} aria-hidden="true" />
          정산
        </button>
        <button
          type="button"
          className={`admin-tab${section === "notices" ? " is-active" : ""}`}
          aria-pressed={section === "notices"}
          onClick={() => setSection("notices")}
        >
          <Megaphone size={16} aria-hidden="true" />
          공지
        </button>
        <button
          type="button"
          className={`admin-tab${section === "banners" ? " is-active" : ""}`}
          aria-pressed={section === "banners"}
          onClick={() => setSection("banners")}
        >
          <ImageIcon size={16} aria-hidden="true" />
          배너
        </button>
        <button
          type="button"
          className={`admin-tab${section === "featured" ? " is-active" : ""}`}
          aria-pressed={section === "featured"}
          onClick={() => setSection("featured")}
        >
          <Star size={16} aria-hidden="true" />
          추천
        </button>
        <button
          type="button"
          className={`admin-tab${section === "keys" ? " is-active" : ""}`}
          aria-pressed={section === "keys"}
          onClick={() => setSection("keys")}
        >
          <KeyRound size={16} aria-hidden="true" />
          API 키
        </button>
      </div>

      {section === "keys" ? (
        <CredentialsPanel endpoint="/api/admin/credentials" variant="server" />
      ) : section === "notices" ? (
        <NoticesView />
      ) : section === "banners" ? (
        <BannersView />
      ) : section === "featured" ? (
        <FeaturedView />
      ) : section === "settlement" ? (
        <SettlementView />
      ) : section === "authors" ? (
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
          onRefreshCover={(b) => void refreshCover(b)}
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
  onRefreshCover,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  books: StoreBook[] | null;
  busy: boolean;
  onPreview: (b: StoreBook) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (b: StoreBook) => void;
  onRefreshCover: (b: StoreBook) => void;
}) {
  return (
    <>
      <div className="admin-tabs admin-tabs--filters">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`admin-tab admin-tab--${t.key}${tab === t.key ? " is-active" : ""}`}
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.key === "pending" && <Clock3 size={14} aria-hidden="true" />}
            {t.key === "approved" && <Globe2 size={14} aria-hidden="true" />}
            {t.key === "drafts" && <FilePenLine size={14} aria-hidden="true" />}
            {t.key === "rejected" && <Ban size={14} aria-hidden="true" />}
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
                {b.kind === "editor" && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--preview"
                    onClick={() => onRefreshCover(b)}
                    disabled={busy}
                    title="표지를 560px로 다시 렌더해 화질 개선"
                  >
                    <RotateCcw size={16} /> 표지개선
                  </button>
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
      <div className="admin-tabs admin-tabs--filters">
        {AUTHOR_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`admin-tab admin-tab--${t.key}${tab === t.key ? " is-active" : ""}`}
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.key === "pending" && <Clock3 size={14} aria-hidden="true" />}
            {t.key === "approved" && <Check size={14} aria-hidden="true" />}
            {t.key === "rejected" && <Ban size={14} aria-hidden="true" />}
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

// Standard KR rates; confirm with an accountant per the platform's tax status.
const VAT_RATE = 0.1; // 부가가치세 10%
const WITHHOLDING = 0.033; // 사업소득 원천징수 3.3%

// Themed inline styles (kept inline so they don't depend on globals.css build).
const sControls: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 16,
  alignItems: "flex-end",
  marginBottom: 18,
};
const sField: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 13,
  fontWeight: 700,
  color: "#6a4a2b",
};
const sInput: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(120,90,60,0.22)",
  background: "var(--paper)",
  color: "#3a2a1d",
  fontSize: 15,
  fontWeight: 600,
  outline: "none",
};
const sSummary: CSSProperties = {
  color: "#6a4a2b",
  fontSize: 14,
  margin: "0 0 12px",
};
const sCard: CSSProperties = {
  background: "var(--paper)",
  borderRadius: 16,
  boxShadow: "0 14px 30px -24px rgba(70,48,30,0.5)",
  overflow: "hidden",
};
const sTable: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};
const sTh: CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  fontSize: 12,
  fontWeight: 800,
  color: "#8a7561",
  background: "rgba(120,90,60,0.06)",
};
const sTd: CSSProperties = {
  padding: "12px 16px",
  color: "#3a2a1d",
  borderTop: "1px solid rgba(120,90,60,0.1)",
};
const sShare: CSSProperties = {
  width: 60,
  padding: "7px 8px",
  borderRadius: 9,
  border: "1px solid rgba(120,90,60,0.22)",
  background: "#fff",
  color: "#3a2a1d",
  fontSize: 14,
  fontWeight: 700,
  textAlign: "center",
  outline: "none",
};
const sSave: CSSProperties = {
  marginLeft: 6,
  padding: "6px 12px",
  border: 0,
  borderRadius: 999,
  background: "linear-gradient(180deg,#ff9b6f,#f06f5f)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
const sNote: CSSProperties = {
  color: "#b09a78",
  fontSize: 12,
  marginTop: 12,
  lineHeight: 1.5,
};

// Monthly read-based author settlement: VAT split out, payment fees deducted →
// distributable pool shared by read proportion × each author's revenue share,
// then 3.3% withheld per author.
function SettlementView() {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}`;
  const [period, setPeriod] = useState(thisMonth);
  const [gross, setGross] = useState("0");
  const [feePct, setFeePct] = useState("3");
  const [data, setData] = useState<Settlement | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareEdits, setShareEdits] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    setData(null);
    getSettlement(period).then(setData);
  }, [period]);
  useEffect(() => {
    load();
  }, [load]);

  const saveShare = async (userId: string) => {
    const share = Math.max(
      0,
      Math.min(100, Math.round(Number(shareEdits[userId]))),
    );
    if (Number.isNaN(share)) return;
    setBusy(true);
    try {
      await setAuthorShare(userId, share);
      setShareEdits((p) => {
        const n = { ...p };
        delete n[userId];
        return n;
      });
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const grossNum = Math.max(0, Math.floor(Number(gross) || 0));
  const feeRate = Math.max(0, Math.min(100, Number(feePct) || 0)) / 100;
  const vat = Math.round(grossNum - grossNum / (1 + VAT_RATE));
  const supply = grossNum - vat;
  const fee = Math.round(grossNum * feeRate);
  const pool = Math.max(0, supply - fee);
  const total = data?.totalReads ?? 0;
  const won = (n: number) => formatPrice(Math.round(n));

  let totNet = 0;
  let totWithhold = 0;
  let totPlatform = 0;
  for (const a of data?.authors ?? []) {
    const slice = total > 0 ? (pool * a.reads) / total : 0;
    const ag = slice * (a.share / 100);
    totWithhold += ag * WITHHOLDING;
    totNet += ag * (1 - WITHHOLDING);
    totPlatform += slice - ag;
  }

  return (
    <div>
      <div style={sControls}>
        <label style={sField}>
          정산 월
          <input
            type="month"
            style={sInput}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </label>
        <label style={sField}>
          총 구독 매출 (₩, 부가세 포함)
          <input
            type="number"
            min={0}
            style={{ ...sInput, width: 200 }}
            value={gross}
            placeholder="예: 1100000"
            onChange={(e) => setGross(e.target.value)}
          />
        </label>
        <label style={sField}>
          결제 수수료 (%)
          <input
            type="number"
            min={0}
            step={0.1}
            style={{ ...sInput, width: 110 }}
            value={feePct}
            onChange={(e) => setFeePct(e.target.value)}
          />
        </label>
      </div>

      {grossNum > 0 && (
        <p style={sSummary}>
          공급가액 <strong>{won(supply)}</strong>{" "}
          <span style={{ color: "#b09a78" }}>(부가세 {won(vat)} 분리)</span> ·
          결제수수료 −<strong>{won(fee)}</strong> → 분배 풀{" "}
          <strong style={{ color: "#c75b46" }}>{won(pool)}</strong>
        </p>
      )}

      {data === null ? (
        <p className="store-empty">불러오는 중…</p>
      ) : data.authors.length === 0 ? (
        <div className="store-empty">
          <p>{period}에 읽힌 책이 없어요.</p>
        </div>
      ) : (
        <>
          <p style={sSummary}>
            월 조회수({period}) <strong>{total}</strong>회 · 누적 조회수{" "}
            <strong>{data.totalAllReads}</strong>회 · 작가 실지급 합계{" "}
            <strong style={{ color: "#c75b46" }}>{won(totNet)}</strong>{" "}
            <span style={{ color: "#b09a78" }}>
              (원천징수 {won(totWithhold)})
            </span>{" "}
            · 플랫폼 몫 <strong style={{ color: "#c75b46" }}>{won(totPlatform)}</strong>
          </p>
          <div style={sCard}>
            <table style={sTable}>
              <thead>
                <tr>
                  <th style={sTh}>작가</th>
                  <th style={sTh}>월 조회수 ({period})</th>
                  <th style={sTh}>누적 조회수</th>
                  <th style={sTh}>비율</th>
                  <th style={sTh}>작가 비율(%)</th>
                  <th style={sTh}>정산액(세전)</th>
                  <th style={sTh}>원천징수 3.3%</th>
                  <th style={sTh}>실지급액</th>
                  <th style={sTh}>플랫폼 몫</th>
                </tr>
              </thead>
              <tbody>
                {data.authors.map((a) => {
                  const readShare = total > 0 ? a.reads / total : 0;
                  const slice = pool * readShare;
                  const ag = slice * (a.share / 100);
                  const wh = ag * WITHHOLDING;
                  const net = ag - wh;
                  const platform = slice - ag;
                  const editing = shareEdits[a.userId] ?? String(a.share);
                  const dirty =
                    shareEdits[a.userId] !== undefined &&
                    Number(shareEdits[a.userId]) !== a.share;
                  const isOpen = expanded === a.userId;
                  return (
                    <Fragment key={a.userId}>
                    <tr>
                      <td style={{ ...sTd, fontWeight: 700 }}>
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : a.userId)}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            font: "inherit", fontWeight: 700, color: "#5a3", padding: 0,
                            display: "inline-flex", alignItems: "center", gap: 4,
                          }}
                          title="클릭하면 책별 조회 내역"
                        >
                          {isOpen ? "▾" : "▸"} {a.name || a.userId}
                        </button>
                      </td>
                      <td style={sTd}>{a.reads}</td>
                      <td style={sTd}>{a.totalReads}</td>
                      <td style={sTd}>{(readShare * 100).toFixed(1)}%</td>
                      <td style={sTd}>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          style={sShare}
                          value={editing}
                          onChange={(e) =>
                            setShareEdits((p) => ({
                              ...p,
                              [a.userId]: e.target.value,
                            }))
                          }
                        />
                        {dirty && (
                          <button
                            type="button"
                            style={sSave}
                            disabled={busy}
                            onClick={() => void saveShare(a.userId)}
                          >
                            저장
                          </button>
                        )}
                      </td>
                      <td style={{ ...sTd, fontWeight: 700 }}>{won(ag)}</td>
                      <td style={sTd}>−{won(wh)}</td>
                      <td style={{ ...sTd, fontWeight: 700 }}>{won(net)}</td>
                      <td style={sTd}>{won(platform)}</td>
                    </tr>
                    {isOpen &&
                      a.books.map((bk) => {
                        const bShare = total > 0 ? bk.reads / total : 0;
                        const bSlice = pool * bShare;
                        const bAg = bSlice * (a.share / 100);
                        const bWh = bAg * WITHHOLDING;
                        const bNet = bAg - bWh;
                        const bPlat = bSlice - bAg;
                        return (
                          <tr key={bk.bookId} style={{ background: "#fbf6ec" }}>
                            <td style={{ ...sTd, paddingLeft: 36, color: "#5a4636" }}>
                              {bk.title || bk.bookId}
                            </td>
                            <td style={sTd}>{bk.reads}</td>
                            <td style={sTd}>{bk.totalReads}</td>
                            <td style={sTd}>{(bShare * 100).toFixed(1)}%</td>
                            <td style={{ ...sTd, color: "#b09a78" }}>—</td>
                            <td style={sTd}>{won(bAg)}</td>
                            <td style={sTd}>−{won(bWh)}</td>
                            <td style={{ ...sTd, fontWeight: 700 }}>{won(bNet)}</td>
                            <td style={sTd}>{won(bPlat)}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={sNote}>
            계산: 총매출 → 부가세(10%) 분리 → 결제수수료 공제 = 분배 풀. 작가
            정산액 = 풀 × (작가 월 조회수 ÷ 전체 월 조회수) × (작가 비율 ÷ 100). 실지급액 =
            정산액 − 원천징수 3.3%. 비율은 작가별로 조정·저장 즉시 반영(기본 80%).
            ※ 세무 처리는 플랫폼 과세유형에 따라 다르니 회계사 확인 권장.
          </p>
        </>
      )}
    </div>
  );
}

/* ---------- 스토어 홈 관리: 공지 ---------- */

function NoticesView() {
  const [notices, setNotices] = useState<StoreNotice[] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setNotices(null);
    adminListNotices().then(setNotices);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setTitle("");
    setBody("");
    setPinned(false);
    setEditingId(null);
  };

  const submit = async () => {
    if (!title.trim()) return alert("제목을 입력하세요.");
    setBusy(true);
    try {
      if (editingId) await adminUpdateNotice(editingId, { title, body, pinned });
      else await adminCreateNotice({ title, body, pinned });
      resetForm();
      load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (n: StoreNotice) => {
    if (!window.confirm(`공지 “${n.title}”를 삭제할까요?`)) return;
    setBusy(true);
    try {
      await adminDeleteNotice(n.id);
      if (editingId === n.id) resetForm();
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="admin-form">
        <div className="admin-form__title">
          {editingId ? "공지 수정" : "새 공지 작성"}
        </div>
        <input
          type="text"
          className="admin-form__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          maxLength={120}
        />
        <textarea
          className="admin-form__input admin-form__textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="내용 (줄바꿈 그대로 표시돼요)"
          rows={4}
        />
        <label className="admin-form__check">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
          />
          <Pin size={13} /> 상단 고정
        </label>
        <div className="admin-form__actions">
          {editingId && (
            <button type="button" className="admin-btn admin-btn--preview" onClick={resetForm} disabled={busy}>
              취소
            </button>
          )}
          <button type="button" className="admin-btn admin-btn--approve" onClick={() => void submit()} disabled={busy}>
            <Check size={16} /> {editingId ? "수정 저장" : "등록"}
          </button>
        </div>
      </div>

      {notices === null ? (
        <p className="store-empty">불러오는 중…</p>
      ) : notices.length === 0 ? (
        <div className="store-empty"><p>등록된 공지가 없어요.</p></div>
      ) : (
        <ul className="admin-list">
          {notices.map((n) => (
            <li key={n.id} className="admin-row">
              <div className="admin-row__meta">
                <div className="admin-row__title">
                  {n.pinned && <Pin size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />}
                  {n.title}
                </div>
                <div className="admin-row__author">
                  {new Date(n.createdAt).toLocaleDateString("ko-KR")}
                  {n.updatedAt ? " · 수정됨" : ""}
                </div>
                {n.body && <div className="admin-row__desc">{n.body}</div>}
              </div>
              <div className="admin-row__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--preview"
                  disabled={busy}
                  onClick={() => {
                    setEditingId(n.id);
                    setTitle(n.title);
                    setBody(n.body);
                    setPinned(n.pinned);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <Pencil size={16} /> 수정
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--reject"
                  disabled={busy}
                  onClick={() => void remove(n)}
                >
                  <Trash2 size={16} /> 삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- 스토어 홈 관리: 이벤트 배너 ---------- */

function BannersView() {
  const [banners, setBanners] = useState<AdminBanner[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [startsAt, setStartsAt] = useState(""); // datetime-local, 빈 값 = 즉시
  const [endsAt, setEndsAt] = useState(""); // 빈 값 = 무기한
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setBanners(null);
    adminListBanners().then(setBanners);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!file) return alert("배너 이미지를 선택하세요.");
    setBusy(true);
    try {
      const imageKey = await adminUploadBannerImage(file);
      await adminCreateBanner({
        imageKey,
        linkUrl: linkUrl.trim() || null,
        startsAt: startsAt ? new Date(startsAt).getTime() : null,
        endsAt: endsAt ? new Date(endsAt).getTime() : null,
        sort: (banners?.length ?? 0) + 1,
      });
      setFile(null);
      setLinkUrl("");
      setStartsAt("");
      setEndsAt("");
      load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const bumpSort = async (b: AdminBanner, delta: number) => {
    setBusy(true);
    try {
      await adminUpdateBanner(b.id, { sort: b.sort + delta });
      load();
    } finally {
      setBusy(false);
    }
  };

  const takeDown = async (b: AdminBanner) => {
    if (!window.confirm("이 배너를 지금 내릴까요? (종료 시각을 현재로)")) return;
    setBusy(true);
    try {
      await adminUpdateBanner(b.id, { endsAt: Date.now() });
      load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (b: AdminBanner) => {
    if (!window.confirm("배너를 삭제할까요? (이미지도 함께 삭제)")) return;
    setBusy(true);
    try {
      await adminDeleteBanner(b.id);
      load();
    } finally {
      setBusy(false);
    }
  };

  const statusOf = (b: AdminBanner): string => {
    const now = Date.now();
    if (b.startsAt && b.startsAt > now) return "예약";
    if (b.endsAt && b.endsAt < now) return "종료";
    return b.startsAt || b.endsAt ? "진행중" : "상시";
  };

  return (
    <div>
      <div className="admin-form">
        <div className="admin-form__title">새 배너 등록</div>
        <input
          type="file"
          accept="image/*"
          className="admin-form__input"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <input
          type="url"
          className="admin-form__input"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="클릭 시 이동할 링크 (선택 — 예: /store/all?cat=그림책 또는 https://…)"
        />
        <div className="admin-form__row">
          <label className="admin-form__label">
            시작
            <input
              type="datetime-local"
              className="admin-form__input"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>
          <label className="admin-form__label">
            종료
            <input
              type="datetime-local"
              className="admin-form__input"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </label>
        </div>
        <div className="admin-form__hint">기간을 비우면 상시 노출돼요. 권장 비율 16:6 (예: 1600×600)</div>
        <div className="admin-form__actions">
          <button type="button" className="admin-btn admin-btn--approve" onClick={() => void submit()} disabled={busy || !file}>
            <Check size={16} /> 등록
          </button>
        </div>
      </div>

      {banners === null ? (
        <p className="store-empty">불러오는 중…</p>
      ) : banners.length === 0 ? (
        <div className="store-empty"><p>등록된 배너가 없어요.</p></div>
      ) : (
        <ul className="admin-list">
          {banners.map((b) => (
            <li key={b.id} className="admin-row">
              <div className="admin-row__cover admin-row__cover--wide">
                <img src={b.imageUrl} alt="배너" />
              </div>
              <div className="admin-row__meta">
                <div className="admin-row__title">
                  <span className={`admin-badge admin-badge--${statusOf(b) === "종료" ? "off" : "on"}`}>
                    {statusOf(b)}
                  </span>{" "}
                  정렬 {b.sort}
                </div>
                <div className="admin-row__author">
                  {b.startsAt ? new Date(b.startsAt).toLocaleString("ko-KR") : "즉시"} ~{" "}
                  {b.endsAt ? new Date(b.endsAt).toLocaleString("ko-KR") : "무기한"}
                </div>
                {b.linkUrl && <div className="admin-row__desc">링크: {b.linkUrl}</div>}
              </div>
              <div className="admin-row__actions">
                <button type="button" className="admin-btn admin-btn--preview" disabled={busy} onClick={() => void bumpSort(b, -1)} title="앞으로">
                  <ArrowUp size={16} />
                </button>
                <button type="button" className="admin-btn admin-btn--preview" disabled={busy} onClick={() => void bumpSort(b, 1)} title="뒤로">
                  <ArrowDown size={16} />
                </button>
                {statusOf(b) !== "종료" && (
                  <button type="button" className="admin-btn admin-btn--preview" disabled={busy} onClick={() => void takeDown(b)}>
                    지금 내리기
                  </button>
                )}
                <button type="button" className="admin-btn admin-btn--reject" disabled={busy} onClick={() => void remove(b)}>
                  <Trash2 size={16} /> 삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- 스토어 홈 관리: 금주의 추천 ---------- */

const FEATURED_LIMIT = 3;

function FeaturedView() {
  const [books, setBooks] = useState<StoreBook[] | null>(null);
  const [featured, setFeatured] = useState<FeaturedEntry[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setBooks(null);
    setFeatured(null);
    void Promise.all([listStoreBooks(), adminListFeatured()]).then(([b, f]) => {
      setBooks(b);
      setFeatured(f);
    });
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const byId = new Map((books ?? []).map((b) => [b.id, b]));
  const current = (featured ?? [])
    .map((f) => ({ entry: f, book: byId.get(f.bookId) }))
    .filter((x): x is { entry: FeaturedEntry; book: StoreBook } => !!x.book);
  const currentIds = new Set(current.map((c) => c.book.id));

  const setPick = async (book: StoreBook) => {
    const note = window.prompt(`“${book.title}” 추천사 (선택)`, "");
    if (note === null) return;
    setBusy(true);
    try {
      await adminSetFeatured(book.id, note.trim() || null, current.length);
      load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const editNote = async (book: StoreBook, prev: string | null) => {
    const note = window.prompt(`“${book.title}” 추천사 수정`, prev ?? "");
    if (note === null) return;
    setBusy(true);
    try {
      await adminSetFeatured(book.id, note.trim() || null);
      load();
    } finally {
      setBusy(false);
    }
  };

  const unset = async (book: StoreBook) => {
    setBusy(true);
    try {
      await adminUnsetFeatured(book.id);
      load();
    } finally {
      setBusy(false);
    }
  };

  if (books === null || featured === null) {
    return <p className="store-empty">불러오는 중…</p>;
  }

  return (
    <div>
      <div className="admin-form">
        <div className="admin-form__title">
          현재 추천 ({current.length}/{FEATURED_LIMIT})
        </div>
        <div className="admin-form__hint">
          지정이 {FEATURED_LIMIT}권보다 적으면 나머지는 인기 점수(좋아요×3+조회수) 상위 책이 자동으로 채워져요.
        </div>
        {current.length === 0 ? (
          <div className="admin-row__desc">지정된 추천이 없어요 — 홈에는 인기 상위 3권이 자동 노출 중.</div>
        ) : (
          <ul className="admin-list">
            {current.map(({ entry, book }) => (
              <li key={book.id} className="admin-row">
                <div className="admin-row__cover">
                  {book.coverThumb ? <img src={book.coverThumb} alt={book.title} /> : <span>표지</span>}
                </div>
                <div className="admin-row__meta">
                  <div className="admin-row__title">{book.title}</div>
                  <div className="admin-row__author">{book.author ?? book.ownerName}</div>
                  <div className="admin-row__desc">
                    {entry.note || <em>추천사 없음 (책 소개로 대체)</em>}
                  </div>
                </div>
                <div className="admin-row__actions">
                  <button type="button" className="admin-btn admin-btn--preview" disabled={busy} onClick={() => void editNote(book, entry.note)}>
                    <Pencil size={16} /> 추천사
                  </button>
                  <button type="button" className="admin-btn admin-btn--reject" disabled={busy} onClick={() => void unset(book)}>
                    <X size={16} /> 해제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="admin-form__title" style={{ margin: "18px 0 8px" }}>공개 중인 책</div>
      <ul className="admin-list">
        {books.map((b) => (
          <li key={b.id} className="admin-row">
            <div className="admin-row__cover">
              {b.coverThumb ? <img src={b.coverThumb} alt={b.title} /> : <span>표지</span>}
            </div>
            <div className="admin-row__meta">
              <div className="admin-row__title">{b.title}</div>
              <div className="admin-row__author">
                {b.author ?? b.ownerName} · ❤ {b.likeCount ?? 0} · 👁 {b.viewCount ?? 0}
              </div>
            </div>
            <div className="admin-row__actions">
              {currentIds.has(b.id) ? (
                <span className="admin-badge admin-badge--on">추천 중</span>
              ) : (
                <button
                  type="button"
                  className="admin-btn admin-btn--approve"
                  disabled={busy || current.length >= FEATURED_LIMIT}
                  title={current.length >= FEATURED_LIMIT ? `추천은 최대 ${FEATURED_LIMIT}권 — 먼저 해제하세요` : undefined}
                  onClick={() => void setPick(b)}
                >
                  <Star size={16} /> 추천 지정
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
