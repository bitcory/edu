import { db, ensureSchema, type Row } from "./db";

/**
 * Server-side data access for store home notices (관리자가 작성하는 공지·소식).
 * body is plain text — the client renders it with white-space: pre-wrap and
 * never as HTML. No client imports.
 */

export type Notice = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: number;
  updatedAt?: number;
};

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function rowToNotice(row: Row): Notice {
  return {
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    pinned: Number(row.pinned) === 1,
    createdAt: Number(row.created_at),
    updatedAt: row.updated_at == null ? undefined : Number(row.updated_at),
  };
}

export async function listNotices(): Promise<Notice[]> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT id, title, body, pinned, created_at, updated_at
          FROM store_notices ORDER BY pinned DESC, created_at DESC`,
    args: [],
  });
  return res.rows.map(rowToNotice);
}

export async function insertNotice(input: {
  title: string;
  body: string;
  pinned?: boolean;
}): Promise<Notice> {
  await ensureSchema();
  const notice: Notice = {
    id: newId(),
    title: input.title.trim(),
    body: input.body,
    pinned: !!input.pinned,
    createdAt: Date.now(),
  };
  await db.execute({
    sql: `INSERT INTO store_notices (id, title, body, pinned, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [notice.id, notice.title, notice.body, notice.pinned ? 1 : 0, notice.createdAt],
  });
  return notice;
}

export async function updateNotice(
  id: string,
  patch: { title?: string; body?: string; pinned?: boolean },
): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: `UPDATE store_notices SET
            title = COALESCE(?, title),
            body = COALESCE(?, body),
            pinned = COALESCE(?, pinned),
            updated_at = ?
          WHERE id = ?`,
    args: [
      patch.title == null ? null : patch.title.trim(),
      patch.body == null ? null : patch.body,
      patch.pinned == null ? null : patch.pinned ? 1 : 0,
      Date.now(),
      id,
    ],
  });
}

export async function deleteNotice(id: string): Promise<void> {
  await ensureSchema();
  await db.execute({ sql: `DELETE FROM store_notices WHERE id = ?`, args: [id] });
}
