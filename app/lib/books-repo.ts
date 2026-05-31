import { db, ensureSchema, type Row } from "./db";
import { normalizeCategory } from "./categories";
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
    // Store-list queries omit the heavy `pages` blob (cards only need the
    // cover thumb); it's hydrated on open via getBookById. Default to [].
    pages: row.pages == null ? [] : (JSON.parse(String(row.pages)) as EditorPage[]),
    coverThumb: row.cover_thumb == null ? undefined : String(row.cover_thumb),
    status: String(row.status) as BookStatus,
    submittedAt: Number(row.submitted_at),
    reviewedAt: row.reviewed_at == null ? undefined : Number(row.reviewed_at),
    rejectReason:
      row.reject_reason == null ? undefined : String(row.reject_reason),
    likeCount: row.like_count == null ? undefined : Number(row.like_count),
    audioKey: row.audio_key == null ? undefined : String(row.audio_key),
  };
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
                   b.cover_thumb, b.status, b.submitted_at, b.reviewed_at,
                   b.reject_reason, b.audio_key,
                   (SELECT COUNT(*) FROM likes l WHERE l.book_id = b.id) AS like_count
            FROM books b
            WHERE b.status = 'approved'
            ORDER BY COALESCE(b.reviewed_at, b.submitted_at) DESC`,
      args: [],
    });
    return res.rows.map(rowToBook);
  }
  if (scope === "pending") {
    const res = await db.execute({
      sql: `SELECT * FROM books WHERE status = 'pending' ORDER BY submitted_at ASC`,
      args: [],
    });
    return res.rows.map(rowToBook);
  }
  if (scope === "rejected") {
    const res = await db.execute({
      sql: `SELECT * FROM books WHERE status = 'rejected'
            ORDER BY COALESCE(reviewed_at, submitted_at) DESC`,
      args: [],
    });
    return res.rows.map(rowToBook);
  }
  if (scope === "drafts") {
    // Admin view of EVERY user's 임시저장 books. Lite (omit the heavy pages
    // blob) — content is hydrated on open/edit via getBookById.
    const res = await db.execute({
      sql: `SELECT id, title, kind, author, description, category, price,
                   page_w, layout, owner_id, owner_name, cover_thumb, status,
                   submitted_at, reviewed_at, reject_reason, audio_key
            FROM books WHERE status = 'draft'
            ORDER BY submitted_at DESC`,
      args: [],
    });
    return res.rows.map(rowToBook);
  }
  // scope === "mine"
  if (!ownerId) return [];
  const res = await db.execute({
    sql: `SELECT * FROM books WHERE owner_id = ? ORDER BY submitted_at DESC`,
    args: [ownerId],
  });
  return res.rows.map(rowToBook);
}

export async function getBookById(id: string): Promise<StoreBook | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT * FROM books WHERE id = ?`,
    args: [id],
  });
  const row = res.rows[0];
  return row ? rowToBook(row) : null;
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
): Promise<StoreBook> {
  await ensureSchema();
  const book: StoreBook = {
    id: newId(),
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
    // Prefer an explicit cover (from the submit modal); else the first page.
    coverThumb: input.coverThumb || input.pages[0]?.thumb,
    status,
    submittedAt: Date.now(),
  };
  await db.execute({
    sql: `INSERT INTO books
            (id, title, author, description, category, price, page_w, layout, owner_id, owner_name, pages, cover_thumb, status, submitted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      JSON.stringify(book.pages),
      book.coverThumb ?? null,
      book.status,
      book.submittedAt,
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
  await db.execute({
    sql: `INSERT INTO books
            (id, title, kind, author, description, category, price, page_w, layout, owner_id, owner_name, pages, cover_thumb, status, submitted_at)
          VALUES (?, ?, 'pdf', ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?)`,
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
      book.coverThumb ?? null,
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
  const coverThumb = patch.coverThumb || patch.pages[0]?.thumb || null;
  const submittedAt = Date.now();
  await db.execute({
    sql: `UPDATE books
          SET pages = ?, cover_thumb = ?, title = ?, author = ?, description = ?, category = ?, price = ?,
              page_w = ?, layout = ?,
              status = ?, submitted_at = ?, reviewed_at = NULL, reject_reason = NULL
          WHERE id = ?`,
    args: [
      JSON.stringify(patch.pages),
      coverThumb,
      title,
      author,
      description,
      category,
      price,
      pageW,
      layout,
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
  const coverThumb =
    patch.coverThumb !== undefined
      ? patch.coverThumb || null
      : (existing.coverThumb ?? null);
  await db.execute({
    sql: `UPDATE books SET title = ?, author = ?, price = ?, description = ?, category = ?, cover_thumb = ? WHERE id = ?`,
    args: [title, author, price, description, category, coverThumb, id],
  });
  return getBookById(id);
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
