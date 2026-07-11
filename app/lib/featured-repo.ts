import { db, ensureSchema, type Row } from "./db";

/**
 * Server-side data access for 금주의 추천 책 (admin curation). book_id PK 라
 * 한 책은 한 번만 지정된다. books 와 FK 없음 — 홈 조합 시 승인 목록에 없는
 * book_id 는 조용히 스킵. No client imports.
 */

export type FeaturedRow = {
  bookId: string;
  note: string | null;
  sort: number;
  createdAt: number;
};

function rowToFeatured(row: Row): FeaturedRow {
  return {
    bookId: String(row.book_id),
    note: row.note == null ? null : String(row.note),
    sort: Number(row.sort ?? 0),
    createdAt: Number(row.created_at),
  };
}

export async function listFeatured(): Promise<FeaturedRow[]> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT * FROM featured_books ORDER BY sort, created_at`,
    args: [],
  });
  return res.rows.map(rowToFeatured);
}

export async function upsertFeatured(
  bookId: string,
  note: string | null,
  sort = 0,
): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: `INSERT INTO featured_books (book_id, note, sort, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (book_id) DO UPDATE SET note = EXCLUDED.note, sort = EXCLUDED.sort`,
    args: [bookId, note, sort, Date.now()],
  });
}

export async function removeFeatured(bookId: string): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: `DELETE FROM featured_books WHERE book_id = ?`,
    args: [bookId],
  });
}
