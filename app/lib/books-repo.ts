import { db, ensureSchema, type Row } from "./db";
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
    price: row.price == null ? 0 : Number(row.price),
    pageW: row.page_w == null ? 800 : Number(row.page_w),
    layout: (row.layout == null ? "spread" : String(row.layout)) as StoreBook["layout"],
    ownerId: String(row.owner_id),
    ownerName: String(row.owner_name),
    pages: JSON.parse(String(row.pages)) as EditorPage[],
    coverThumb: row.cover_thumb == null ? undefined : String(row.cover_thumb),
    status: String(row.status) as BookStatus,
    submittedAt: Number(row.submitted_at),
    reviewedAt: row.reviewed_at == null ? undefined : Number(row.reviewed_at),
    rejectReason:
      row.reject_reason == null ? undefined : String(row.reject_reason),
  };
}

export async function listBooks(
  scope: BookScope,
  ownerId?: string,
): Promise<StoreBook[]> {
  await ensureSchema();
  if (scope === "store") {
    const res = await db.execute({
      sql: `SELECT * FROM books WHERE status = 'approved'
            ORDER BY COALESCE(reviewed_at, submitted_at) DESC`,
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
): Promise<StoreBook> {
  await ensureSchema();
  const book: StoreBook = {
    id: newId(),
    title: input.title.trim() || "제목 없는 책",
    kind: "editor",
    author: input.author?.trim() || owner.name,
    description: input.description?.trim() || undefined,
    price: normalizePrice(input.price),
    pageW: input.pageW || 800,
    layout: input.layout || "spread",
    ownerId: owner.id,
    ownerName: owner.name,
    pages: input.pages,
    coverThumb: input.pages[0]?.thumb,
    status: initialEditorStatus(),
    submittedAt: Date.now(),
  };
  await db.execute({
    sql: `INSERT INTO books
            (id, title, author, description, price, page_w, layout, owner_id, owner_name, pages, cover_thumb, status, submitted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      book.id,
      book.title,
      book.author ?? null,
      book.description ?? null,
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
  input: { title: string; coverThumb?: string },
  owner: { id: string; name: string },
): Promise<StoreBook> {
  await ensureSchema();
  const book: StoreBook = {
    id: newId(),
    title: input.title.trim() || "내 PDF 책",
    kind: "pdf",
    author: owner.name,
    price: 0,
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
            (id, title, kind, author, price, page_w, layout, owner_id, owner_name, pages, cover_thumb, status, submitted_at)
          VALUES (?, ?, 'pdf', ?, 0, ?, ?, ?, ?, '[]', ?, ?, ?)`,
    args: [
      book.id,
      book.title,
      book.author ?? null,
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

/** Re-edit: overwrite snapshot, reset to pending for re-review. */
export async function updateBookSnapshot(
  id: string,
  patch: {
    pages: EditorPage[];
    title?: string;
    description?: string;
    price?: number;
    pageW?: number;
    layout?: StoreBook["layout"];
  },
): Promise<StoreBook | null> {
  await ensureSchema();
  const existing = await getBookById(id);
  if (!existing) return null;
  const title = patch.title?.trim() || existing.title;
  const description =
    patch.description !== undefined
      ? patch.description.trim() || null
      : (existing.description ?? null);
  const price =
    patch.price !== undefined ? normalizePrice(patch.price) : existing.price;
  const pageW = patch.pageW ?? existing.pageW;
  const layout = patch.layout ?? existing.layout;
  const submittedAt = Date.now();
  await db.execute({
    sql: `UPDATE books
          SET pages = ?, cover_thumb = ?, title = ?, description = ?, price = ?,
              page_w = ?, layout = ?,
              status = ?, submitted_at = ?, reviewed_at = NULL, reject_reason = NULL
          WHERE id = ?`,
    args: [
      JSON.stringify(patch.pages),
      patch.pages[0]?.thumb ?? null,
      title,
      description,
      price,
      pageW,
      layout,
      initialEditorStatus(),
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
  patch: { title?: string; price?: number; description?: string },
): Promise<StoreBook | null> {
  await ensureSchema();
  const existing = await getBookById(id);
  if (!existing) return null;
  const title = patch.title?.trim() || existing.title;
  const price =
    patch.price !== undefined ? normalizePrice(patch.price) : existing.price;
  const description =
    patch.description !== undefined
      ? patch.description.trim() || null
      : (existing.description ?? null);
  await db.execute({
    sql: `UPDATE books SET title = ?, price = ?, description = ? WHERE id = ?`,
    args: [title, price, description, id],
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
