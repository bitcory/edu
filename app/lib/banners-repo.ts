import { db, ensureSchema, type Row } from "./db";

/**
 * Server-side data access for store home event banners. imageKey points at an
 * R2 object under banners/ (see pdf-storage banner helpers). No client imports.
 */

export type Banner = {
  id: string;
  imageKey: string;
  linkUrl: string | null;
  startsAt: number | null;
  endsAt: number | null;
  sort: number;
  createdAt: number;
};

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function rowToBanner(row: Row): Banner {
  return {
    id: String(row.id),
    imageKey: String(row.image_key),
    linkUrl: row.link_url == null ? null : String(row.link_url),
    startsAt: row.starts_at == null ? null : Number(row.starts_at),
    endsAt: row.ends_at == null ? null : Number(row.ends_at),
    sort: Number(row.sort ?? 0),
    createdAt: Number(row.created_at),
  };
}

/** 관리용 — 기간 무관 전체. */
export async function listBanners(): Promise<Banner[]> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT * FROM store_banners ORDER BY sort, created_at DESC`,
    args: [],
  });
  return res.rows.map(rowToBanner);
}

/** 홈 노출용 — 기간(starts/ends) 안에 있는 배너만. NULL 은 무제한. */
export async function listActiveBanners(now = Date.now()): Promise<Banner[]> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT * FROM store_banners
          WHERE (starts_at IS NULL OR starts_at <= ?)
            AND (ends_at IS NULL OR ends_at >= ?)
          ORDER BY sort, created_at DESC`,
    args: [now, now],
  });
  return res.rows.map(rowToBanner);
}

export async function getBanner(id: string): Promise<Banner | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT * FROM store_banners WHERE id = ?`,
    args: [id],
  });
  return res.rows[0] ? rowToBanner(res.rows[0]) : null;
}

export async function insertBanner(input: {
  imageKey: string;
  linkUrl?: string | null;
  startsAt?: number | null;
  endsAt?: number | null;
  sort?: number;
}): Promise<Banner> {
  await ensureSchema();
  const banner: Banner = {
    id: newId(),
    imageKey: input.imageKey,
    linkUrl: input.linkUrl ?? null,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    sort: input.sort ?? 0,
    createdAt: Date.now(),
  };
  await db.execute({
    sql: `INSERT INTO store_banners (id, image_key, link_url, starts_at, ends_at, sort, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      banner.id,
      banner.imageKey,
      banner.linkUrl,
      banner.startsAt,
      banner.endsAt,
      banner.sort,
      banner.createdAt,
    ],
  });
  return banner;
}

/** linkUrl/기간/sort 수정. undefined 필드는 유지, null 은 NULL 로 지움. */
export async function updateBanner(
  id: string,
  patch: {
    linkUrl?: string | null;
    startsAt?: number | null;
    endsAt?: number | null;
    sort?: number;
  },
): Promise<void> {
  await ensureSchema();
  const sets: string[] = [];
  const args: unknown[] = [];
  if (patch.linkUrl !== undefined) { sets.push("link_url = ?"); args.push(patch.linkUrl); }
  if (patch.startsAt !== undefined) { sets.push("starts_at = ?"); args.push(patch.startsAt); }
  if (patch.endsAt !== undefined) { sets.push("ends_at = ?"); args.push(patch.endsAt); }
  if (patch.sort !== undefined) { sets.push("sort = ?"); args.push(patch.sort); }
  if (!sets.length) return;
  args.push(id);
  await db.execute({
    sql: `UPDATE store_banners SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
}

export async function deleteBanner(id: string): Promise<void> {
  await ensureSchema();
  await db.execute({ sql: `DELETE FROM store_banners WHERE id = ?`, args: [id] });
}
