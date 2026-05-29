import { db, ensureSchema, type Row } from "./db";
import type { BookComment, BookSocial } from "./book-types";

/** Server-side data access for likes + comments. Do NOT import from client. */

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function rowToComment(row: Row): BookComment {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    body: String(row.body),
    createdAt: Number(row.created_at),
  };
}

async function likeCount(bookId: string): Promise<number> {
  const res = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM likes WHERE book_id = ?`,
    args: [bookId],
  });
  return Number(res.rows[0]?.n ?? 0);
}

/** Likes + comments for a book, with whether `userId` has liked it. */
export async function getSocial(
  bookId: string,
  userId?: string,
): Promise<BookSocial> {
  await ensureSchema();
  const [count, likedRes, commentsRes] = await Promise.all([
    likeCount(bookId),
    userId
      ? db.execute({
          sql: `SELECT 1 FROM likes WHERE book_id = ? AND user_id = ?`,
          args: [bookId, userId],
        })
      : Promise.resolve({ rows: [] as Row[] }),
    db.execute({
      sql: `SELECT * FROM comments WHERE book_id = ? ORDER BY created_at ASC`,
      args: [bookId],
    }),
  ]);
  return {
    likeCount: count,
    liked: likedRes.rows.length > 0,
    comments: commentsRes.rows.map(rowToComment),
  };
}

/** Toggle the current user's like. Returns the new state + count. */
export async function toggleLike(
  bookId: string,
  userId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  await ensureSchema();
  const existing = await db.execute({
    sql: `SELECT 1 FROM likes WHERE book_id = ? AND user_id = ?`,
    args: [bookId, userId],
  });
  if (existing.rows.length > 0) {
    await db.execute({
      sql: `DELETE FROM likes WHERE book_id = ? AND user_id = ?`,
      args: [bookId, userId],
    });
    return { liked: false, likeCount: await likeCount(bookId) };
  }
  await db.execute({
    sql: `INSERT INTO likes (book_id, user_id, created_at) VALUES (?, ?, ?)`,
    args: [bookId, userId, Date.now()],
  });
  return { liked: true, likeCount: await likeCount(bookId) };
}

export async function addComment(
  bookId: string,
  user: { id: string; name: string },
  body: string,
): Promise<BookComment> {
  await ensureSchema();
  const comment: BookComment = {
    id: newId(),
    bookId,
    userId: user.id,
    userName: user.name || "익명",
    body: body.trim().slice(0, 1000),
    createdAt: Date.now(),
  };
  await db.execute({
    sql: `INSERT INTO comments (id, book_id, user_id, user_name, body, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      comment.id,
      comment.bookId,
      comment.userId,
      comment.userName,
      comment.body,
      comment.createdAt,
    ],
  });
  return comment;
}

/** Delete a comment. Allowed for its author or an admin (checked by caller). */
export async function getComment(id: string): Promise<BookComment | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT * FROM comments WHERE id = ?`,
    args: [id],
  });
  const row = res.rows[0];
  return row ? rowToComment(row) : null;
}

export async function deleteComment(id: string): Promise<void> {
  await ensureSchema();
  await db.execute({ sql: `DELETE FROM comments WHERE id = ?`, args: [id] });
}
