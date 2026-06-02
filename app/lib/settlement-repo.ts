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

export type AuthorSettlement = {
  userId: string;
  name: string;
  reads: number;
  /** Author's revenue-share percent (platform keeps 100 − share). */
  share: number;
};

export type Settlement = {
  period: string;
  totalReads: number;
  authors: AuthorSettlement[];
};

/**
 * Per-author read counts for a month plus each author's revenue share. Grouped
 * by the book owner; an owner without a registered author row falls back to the
 * default 80% share. The caller multiplies a (manually entered) monthly pool by
 * `reads / totalReads × share/100` to get each author's payout.
 */
export async function getSettlement(period: string): Promise<Settlement> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT b.owner_id            AS user_id,
                 MAX(b.owner_name)     AS name,
                 COUNT(*)              AS reads,
                 COALESCE(MAX(a.revenue_share), 80) AS share
          FROM reads r
          JOIN books b ON b.id = r.book_id
          LEFT JOIN authors a ON a.user_id = b.owner_id
          WHERE r.period = ?
          GROUP BY b.owner_id
          ORDER BY reads DESC`,
    args: [period],
  });
  const authors: AuthorSettlement[] = res.rows.map((row: Row) => ({
    userId: String(row.user_id),
    name: String(row.name ?? ""),
    reads: Number(row.reads ?? 0),
    share: Number(row.share ?? 80),
  }));
  const totalReads = authors.reduce((sum, a) => sum + a.reads, 0);
  return { period, totalReads, authors };
}
