import { db, ensureSchema, type Row } from "./db";

/** 'YYYY-MM' month bucket for a timestamp (defaults to now), in UTC. */
export function periodOf(ms: number = Date.now()): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Record that `userId` read `bookId`. Deduped per (book, user, month) by the
 * primary key, so re-reading within a month counts once — that's the unit the
 * monthly settlement divides the subscription pool by.
 */
export async function recordRead(
  bookId: string,
  userId: string,
): Promise<void> {
  await ensureSchema();
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO reads (book_id, user_id, period, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (book_id, user_id, period) DO NOTHING`,
    args: [bookId, userId, periodOf(now), now],
  });
}

/** Set an author's revenue share percent (0–100, clamped). */
export async function setAuthorShare(
  userId: string,
  share: number,
): Promise<void> {
  await ensureSchema();
  const s = Math.max(0, Math.min(100, Math.round(share)));
  await db.execute({
    sql: `UPDATE authors SET revenue_share = ? WHERE user_id = ?`,
    args: [s, userId],
  });
}

export type BookReads = {
  bookId: string;
  title: string;
  reads: number; // this month (selected period)
  totalReads: number; // cumulative (all months)
};

export type AuthorSettlement = {
  userId: string;
  name: string;
  reads: number; // this month — used for the payout split
  totalReads: number; // cumulative (all months) — display
  /** Author's revenue-share percent (platform keeps 100 − share). */
  share: number;
  books: BookReads[]; // per-book breakdown (월 + 누적)
};

export type Settlement = {
  period: string;
  totalReads: number; // this month's total (payout base)
  totalAllReads: number; // cumulative total (display)
  authors: AuthorSettlement[];
};

/**
 * Per-author read counts — both for the selected month (payout base) and
 * cumulative across all months — plus a per-book breakdown. Grouped by the book
 * owner; an owner without a registered author row falls back to 80% share. The
 * caller multiplies a (manually entered) monthly pool by `reads / totalReads ×
 * share/100` to get each author's payout (still uses the monthly `reads`).
 */
export async function getSettlement(period: string): Promise<Settlement> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT b.id                 AS book_id,
                 b.title              AS title,
                 b.owner_id           AS user_id,
                 MAX(b.owner_name)    AS name,
                 COALESCE(MAX(a.revenue_share), 80) AS share,
                 COUNT(*) FILTER (WHERE r.period = ?) AS period_reads,
                 COUNT(*)             AS total_reads
          FROM reads r
          JOIN books b ON b.id = r.book_id
          LEFT JOIN authors a ON a.user_id = b.owner_id
          GROUP BY b.id, b.title, b.owner_id
          ORDER BY total_reads DESC`,
    args: [period],
  });
  const byAuthor = new Map<string, AuthorSettlement>();
  for (const row of res.rows as Row[]) {
    const uid = String(row.user_id);
    let a = byAuthor.get(uid);
    if (!a) {
      a = { userId: uid, name: String(row.name ?? ""), reads: 0, totalReads: 0, share: Number(row.share ?? 80), books: [] };
      byAuthor.set(uid, a);
    }
    const pr = Number(row.period_reads ?? 0);
    const tr = Number(row.total_reads ?? 0);
    a.reads += pr;
    a.totalReads += tr;
    a.books.push({ bookId: String(row.book_id), title: String(row.title ?? ""), reads: pr, totalReads: tr });
  }
  const authors = [...byAuthor.values()].sort(
    (x, y) => y.reads - x.reads || y.totalReads - x.totalReads,
  );
  authors.forEach((a) => a.books.sort((x, y) => y.totalReads - x.totalReads));
  const totalReads = authors.reduce((sum, a) => sum + a.reads, 0);
  const totalAllReads = authors.reduce((sum, a) => sum + a.totalReads, 0);
  return { period, totalReads, totalAllReads, authors };
}
