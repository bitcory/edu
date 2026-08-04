import { db, ensureSchema, type Row } from "./db";
import { normalizeCategory } from "./categories";
import {
  presignCoverDownload,
  saveCoverFromDataUrl,
  saveSnapshot,
} from "./pdf-storage";
import { initialEditorStatus, initialPdfStatus } from "./publish-policy";
import type { EditorPage } from "./editor-types";
import type {
  BookKind,
  BookScope,
  BookStatus,
  StoreBook,
  SubmitInput,
} from "./book-types";

/**
 * Server-side data access for books. All SQL lives here so swapping the
 * backend later (Postgres/Turso + R2 for the PDF) only touches this file.
 * Do NOT import from client components.
 */

function rowToBook(row: Row): StoreBook {
  return {
    id: String(row.id),
    title: String(row.title),
    kind: (row.kind == null ? "editor" : String(row.kind)) as BookKind,
    author: row.author == null ? undefined : String(row.author),
    description: row.description == null ? undefined : String(row.description),
    category: row.category == null ? undefined : String(row.category),
    price: row.price == null ? 0 : Number(row.price),
    pageW: row.page_w == null ? 800 : Number(row.page_w),
    layout: (row.layout == null ? "spread" : String(row.layout)) as StoreBook["layout"],
    ownerId: String(row.owner_id),
    ownerName: String(row.owner_name),
    // The page snapshot lives in R2 (snapshot_key); the DB pages column is kept
    // '[]'. Pages are hydrated from R2 on open (see GET /api/books/[id]).
    pages: row.pages == null ? [] : (JSON.parse(String(row.pages)) as EditorPage[]),
    snapshotKey: row.snapshot_key == null ? undefined : String(row.snapshot_key),
    pageCount: row.page_count == null ? undefined : Number(row.page_count),
    coverThumb: row.cover_thumb == null ? undefined : String(row.cover_thumb),
    coverKey: row.cover_key == null ? undefined : String(row.cover_key),
    status: String(row.status) as BookStatus,
    submittedAt: Number(row.submitted_at),
    reviewedAt: row.reviewed_at == null ? undefined : Number(row.reviewed_at),
    rejectReason:
      row.reject_reason == null ? undefined : String(row.reject_reason),
    likeCount: row.like_count == null ? undefined : Number(row.like_count),
    viewCount: row.view_count == null ? undefined : Number(row.view_count),
    audioKey: row.audio_key == null ? undefined : String(row.audio_key),
    narration:
      row.narration == null
        ? undefined
        : (JSON.parse(String(row.narration)) as (string | null)[]),
    storyText: row.story_text == null ? undefined : String(row.story_text),
  };
}

/** Covers live in R2 (cover_key) — swap the key for a presigned URL so the
 * client's <img src> keeps working unchanged. Legacy un-migrated books still
 * carry an inline base64 cover_thumb and pass through as-is. */
async function withCoverUrl(book: StoreBook): Promise<StoreBook> {
  if (book.coverKey) {
    book.coverThumb = await presignCoverDownload(book.coverKey);
  }
  return book;
}

function withCoverUrls(books: StoreBook[]): Promise<StoreBook[]> {
  return Promise.all(books.map(withCoverUrl));
}

/** Resolve an incoming coverThumb value to what the row should store.
 *  - data URL (new image from the client) → upload to R2, store the key.
 *  - http(s) URL (the client echoing back a presigned cover) or absent → keep
 *    whatever is stored now (key, or legacy inline base64).
 */
async function resolveCover(
  bookId: string,
  incoming: string | undefined,
  existing?: StoreBook | null,
): Promise<{ coverKey: string | null; coverThumb: string | null }> {
  if (incoming?.startsWith("data:")) {
    const key = await saveCoverFromDataUrl(bookId, incoming);
    if (key) return { coverKey: key, coverThumb: null };
  }
  return {
    coverKey: existing?.coverKey ?? null,
    coverThumb: existing?.coverThumb?.startsWith("data:")
      ? existing.coverThumb
      : null,
  };
}

/** Replace a book's per-page narration manifest (JSON array of R2 keys). */
export async function setBookNarration(
  id: string,
  narration: (string | null)[],
): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: `UPDATE books SET narration = ? WHERE id = ?`,
    args: [JSON.stringify(narration), id],
  });
}

/** 표지 이미지 키를 직접 지정한다. 브라우저가 올린 data URL 이 아니라 이미
 * 저장소에 있는 파일을 표지로 삼을 때 쓴다 (「그림책 만들기」). */
export async function setBookCover(id: string, coverKey: string): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: `UPDATE books SET cover_key = ?, cover_thumb = NULL WHERE id = ?`,
    args: [coverKey, id],
  });
}

/** Set or clear (null) a book's background-music R2 key. */
export async function setBookAudio(
  id: string,
  audioKey: string | null,
): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: `UPDATE books SET audio_key = ? WHERE id = ?`,
    args: [audioKey, id],
  });
}

export async function listBooks(
  scope: BookScope,
  ownerId?: string,
): Promise<StoreBook[]> {
  await ensureSchema();
  if (scope === "store") {
    // Explicitly list columns and OMIT the heavy `pages` blob — store cards
    // only render cover_thumb + metadata. Including pages made the response
    // balloon to many MB (every page's full-res base64 image), which is why
    // the store was slow to load. Pages are fetched on open via getBookById.
    const res = await db.execute({
      sql: `SELECT b.id, b.title, b.kind, b.author, b.description, b.category,
                   b.price, b.page_w, b.layout, b.owner_id, b.owner_name,
                   b.cover_thumb, b.cover_key, b.status, b.submitted_at, b.reviewed_at,
                   b.reject_reason, b.audio_key, b.page_count,
                   (SELECT COUNT(*) FROM likes l WHERE l.book_id = b.id) AS like_count,
                   (SELECT COUNT(*) FROM reads r WHERE r.book_id = b.id) AS view_count
            FROM books b
            WHERE b.status = 'approved'
            ORDER BY COALESCE(b.reviewed_at, b.submitted_at) DESC`,
      args: [],
    });
    return withCoverUrls(res.rows.map(rowToBook));
  }
  if (scope === "pending") {
    const res = await db.execute({
      sql: `SELECT * FROM books WHERE status = 'pending' ORDER BY submitted_at ASC`,
      args: [],
    });
    return withCoverUrls(res.rows.map(rowToBook));
  }
  if (scope === "rejected") {
    const res = await db.execute({
      sql: `SELECT * FROM books WHERE status = 'rejected'
            ORDER BY COALESCE(reviewed_at, submitted_at) DESC`,
      args: [],
    });
    return withCoverUrls(res.rows.map(rowToBook));
  }
  if (scope === "drafts") {
    // Admin view of EVERY user's 임시저장 books. Lite (omit the heavy pages
    // blob) — content is hydrated on open/edit via getBookById.
    const res = await db.execute({
      sql: `SELECT id, title, kind, author, description, category, price,
                   page_w, layout, owner_id, owner_name, cover_thumb, cover_key, status,
                   submitted_at, reviewed_at, reject_reason, audio_key, page_count
            FROM books WHERE status = 'draft'
            ORDER BY submitted_at DESC`,
      args: [],
    });
    return withCoverUrls(res.rows.map(rowToBook));
  }
  // scope === "mine"
  if (!ownerId) return [];
  const res = await db.execute({
    sql: `SELECT * FROM books WHERE owner_id = ? ORDER BY submitted_at DESC`,
    args: [ownerId],
  });
  return withCoverUrls(res.rows.map(rowToBook));
}

/** An author's PUBLIC (approved) books, most-liked first (then newest). Omits
 *  the heavy pages blob — cards only need cover_thumb + metadata. */
export async function listAuthorBooks(ownerId: string): Promise<StoreBook[]> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT b.id, b.title, b.kind, b.author, b.description, b.category,
                 b.price, b.page_w, b.layout, b.owner_id, b.owner_name,
                 b.cover_thumb, b.cover_key, b.status, b.submitted_at, b.reviewed_at,
                 b.reject_reason, b.audio_key, b.page_count,
                 (SELECT COUNT(*) FROM likes l WHERE l.book_id = b.id) AS like_count
          FROM books b
          WHERE b.owner_id = ? AND b.status = 'approved'
          ORDER BY like_count DESC, COALESCE(b.reviewed_at, b.submitted_at) DESC`,
    args: [ownerId],
  });
  return withCoverUrls(res.rows.map(rowToBook));
}

export async function getBookById(id: string): Promise<StoreBook | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT * FROM books WHERE id = ?`,
    args: [id],
  });
  const row = res.rows[0];
  return row ? withCoverUrl(rowToBook(row)) : null;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Clamp to a non-negative integer number of won. */
function normalizePrice(price: unknown): number {
  const n = Math.floor(Number(price));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function insertBook(
  input: SubmitInput,
  owner: { id: string; name: string },
  status: BookStatus = initialEditorStatus(),
  // Recreate with a specific id (e.g. 임시저장 self-heal when the local draft id
  // is missing from the DB) so the editor's stored draftId stays consistent.
  desiredId?: string,
): Promise<StoreBook> {
  await ensureSchema();
  const book: StoreBook = {
    id: desiredId || newId(),
    title: input.title.trim() || "제목 없는 책",
    kind: "editor",
    author: input.author?.trim() || owner.name,
    description: input.description?.trim() || undefined,
    category: normalizeCategory(input.category),
    price: normalizePrice(input.price),
    pageW: input.pageW || 800,
    layout: input.layout || "spread",
    ownerId: owner.id,
    ownerName: owner.name,
    pages: input.pages,
    pageCount: input.pages.length,
    // Prefer an explicit cover (from the submit modal); else the first page.
    coverThumb: input.coverThumb || input.pages[0]?.thumb,
    storyText: input.storyText?.trim() || undefined,
    status,
    submittedAt: Date.now(),
  };
  // The heavy page snapshot goes to R2, NOT Postgres — keeps the DB row tiny
  // so repeated saves don't balloon Neon's history/storage.
  const snapshotKey = await saveSnapshot(book.id, JSON.stringify(book.pages));
  book.snapshotKey = snapshotKey;
  // Cover image goes to R2 too — the row stores only the key.
  const cover = await resolveCover(book.id, book.coverThumb);
  book.coverKey = cover.coverKey ?? undefined;
  await db.execute({
    sql: `INSERT INTO books
            (id, title, author, description, category, price, page_w, layout, owner_id, owner_name, pages, snapshot_key, page_count, cover_thumb, cover_key, status, submitted_at, story_text)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      book.id,
      book.title,
      book.author ?? null,
      book.description ?? null,
      book.category ?? null,
      book.price,
      book.pageW,
      book.layout,
      book.ownerId,
      book.ownerName,
      snapshotKey,
      book.pageCount ?? 0,
      cover.coverThumb,
      cover.coverKey,
      book.status,
      book.submittedAt,
      book.storyText ?? null,
    ],
  });
  return book;
}

/** Register an uploaded PDF as a private (draft) book in the owner's library.
 * The PDF bytes are stored separately (see pdf-storage); this only writes the
 * row. Returns the book so the caller can save the file under its id. */
export async function insertPdfBook(
  input: {
    title: string;
    author?: string;
    coverThumb?: string;
    description?: string;
    category?: string;
    price?: number;
  },
  owner: { id: string; name: string },
): Promise<StoreBook> {
  await ensureSchema();
  const book: StoreBook = {
    id: newId(),
    title: input.title.trim() || "내 PDF 책",
    kind: "pdf",
    author: input.author?.trim() || owner.name,
    description: input.description?.trim() || undefined,
    category: normalizeCategory(input.category),
    price: normalizePrice(input.price),
    pageW: 800, // unused for PDF rendering (aspect comes from the PDF itself)
    layout: "spread",
    ownerId: owner.id,
    ownerName: owner.name,
    pages: [],
    coverThumb: input.coverThumb,
    status: initialPdfStatus(),
    submittedAt: Date.now(),
  };
  const cover = await resolveCover(book.id, book.coverThumb);
  book.coverKey = cover.coverKey ?? undefined;
  await db.execute({
    sql: `INSERT INTO books
            (id, title, kind, author, description, category, price, page_w, layout, owner_id, owner_name, pages, cover_thumb, cover_key, status, submitted_at)
          VALUES (?, ?, 'pdf', ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?)`,
    args: [
      book.id,
      book.title,
      book.author ?? null,
      book.description ?? null,
      book.category ?? null,
      book.price,
      book.pageW,
      book.layout,
      book.ownerId,
      book.ownerName,
      cover.coverThumb,
      cover.coverKey,
      book.status,
      book.submittedAt,
    ],
  });
  return book;
}

/** Re-edit: overwrite snapshot. `status` controls the resulting state —
 * defaults to the publish status (initialEditorStatus), or pass 'draft' to
 * keep it a private 임시저장. */
export async function updateBookSnapshot(
  id: string,
  patch: {
    pages: EditorPage[];
    title?: string;
    author?: string;
    description?: string;
    category?: string;
    price?: number;
    pageW?: number;
    layout?: StoreBook["layout"];
    coverThumb?: string;
    storyText?: string;
  },
  status: BookStatus = initialEditorStatus(),
): Promise<StoreBook | null> {
  await ensureSchema();
  const existing = await getBookById(id);
  if (!existing) return null;
  const title = patch.title?.trim() || existing.title;
  const author =
    patch.author !== undefined
      ? patch.author.trim() || existing.author || null
      : (existing.author ?? null);
  const description =
    patch.description !== undefined
      ? patch.description.trim() || null
      : (existing.description ?? null);
  const category =
    patch.category !== undefined
      ? normalizeCategory(patch.category)
      : (existing.category ?? null);
  const price =
    patch.price !== undefined ? normalizePrice(patch.price) : existing.price;
  const pageW = patch.pageW ?? existing.pageW;
  const layout = patch.layout ?? existing.layout;
  // Never erase an existing cover: a 임시저장 passes no coverThumb, and a page
  // with no rendered thumb (e.g. a blank editor after a failed load) must not
  // null out the stored one. resolveCover keeps the stored key when the
  // incoming value isn't a fresh data URL (e.g. an echoed presigned URL).
  const cover = await resolveCover(
    id,
    patch.coverThumb || patch.pages[0]?.thumb,
    existing,
  );
  const storyText =
    patch.storyText !== undefined
      ? patch.storyText.trim() || null
      : (existing.storyText ?? null);
  const submittedAt = Date.now();
  // Overwrite the book's R2 snapshot (stable key) — DB pages stays '[]'.
  const snapshotKey = await saveSnapshot(id, JSON.stringify(patch.pages));
  await db.execute({
    sql: `UPDATE books
          SET pages = '[]', snapshot_key = ?, page_count = ?, cover_thumb = ?, cover_key = ?,
              title = ?, author = ?, description = ?, category = ?, price = ?,
              page_w = ?, layout = ?, story_text = ?,
              status = ?, submitted_at = ?, reviewed_at = NULL, reject_reason = NULL
          WHERE id = ?`,
    args: [
      snapshotKey,
      patch.pages.length,
      cover.coverThumb,
      cover.coverKey,
      title,
      author,
      description,
      category,
      price,
      pageW,
      layout,
      storyText,
      status,
      submittedAt,
      id,
    ],
  });
  return getBookById(id);
}

/** Update only metadata (title/price/description). Keeps status & content —
 * used for PDF books (no snapshot to re-render) and quick info edits. */
export async function updateBookMeta(
  id: string,
  patch: {
    title?: string;
    author?: string;
    price?: number;
    description?: string;
    category?: string;
    coverThumb?: string;
  },
): Promise<StoreBook | null> {
  await ensureSchema();
  const existing = await getBookById(id);
  if (!existing) return null;
  const title = patch.title?.trim() || existing.title;
  const author =
    patch.author !== undefined
      ? patch.author.trim() || existing.author || null
      : (existing.author ?? null);
  const price =
    patch.price !== undefined ? normalizePrice(patch.price) : existing.price;
  const description =
    patch.description !== undefined
      ? patch.description.trim() || null
      : (existing.description ?? null);
  const category =
    patch.category !== undefined
      ? normalizeCategory(patch.category)
      : (existing.category ?? null);
  const cover = await resolveCover(id, patch.coverThumb, existing);
  await db.execute({
    sql: `UPDATE books SET title = ?, author = ?, price = ?, description = ?, category = ?, cover_thumb = ?, cover_key = ? WHERE id = ?`,
    args: [
      title,
      author,
      price,
      description,
      category,
      cover.coverThumb,
      cover.coverKey,
      id,
    ],
  });
  return getBookById(id);
}

/** Sync the current owner's display name across existing books. */
export async function renameOwnerBooks(
  ownerId: string,
  _oldName: string | null | undefined,
  newName: string,
): Promise<void> {
  await ensureSchema();
  const clean = newName.trim();
  if (!clean) return;
  await db.execute({
    sql: `UPDATE books SET owner_name = ?, author = ? WHERE owner_id = ?`,
    args: [clean, clean, ownerId],
  });
}

export async function deleteBook(id: string): Promise<void> {
  await ensureSchema();
  await db.execute({ sql: `DELETE FROM books WHERE id = ?`, args: [id] });
}

export async function setBookStatus(
  id: string,
  status: Exclude<BookStatus, "pending">,
  rejectReason?: string,
): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: `UPDATE books SET status = ?, reviewed_at = ?, reject_reason = ? WHERE id = ?`,
    args: [status, Date.now(), rejectReason?.trim() || null, id],
  });
}
