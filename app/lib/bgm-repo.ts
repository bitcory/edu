import { db, ensureSchema } from "./db";

/**
 * Server-side data access for the shared background-music pool. Track rows
 * point at an R2 object (see pdf-storage bgm helpers). No client imports.
 */

export type BgmTrack = {
  id: string;
  name: string;
  key: string;
  ownerId: string;
  ownerName: string;
  createdAt: number;
};

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function listBgmTracks(): Promise<BgmTrack[]> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT id, name, key, owner_id, owner_name, created_at
          FROM bgm_tracks ORDER BY created_at DESC`,
    args: [],
  });
  return res.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    key: String(row.key),
    ownerId: String(row.owner_id),
    ownerName: String(row.owner_name),
    createdAt: Number(row.created_at),
  }));
}

export async function getBgmTrack(id: string): Promise<BgmTrack | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT id, name, key, owner_id, owner_name, created_at
          FROM bgm_tracks WHERE id = ?`,
    args: [id],
  });
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    key: String(row.key),
    ownerId: String(row.owner_id),
    ownerName: String(row.owner_name),
    createdAt: Number(row.created_at),
  };
}

/** Create a track row. The R2 key is derived from the id (bgm/<id>.mp3), which
 * matches presignBgmUpload(id), so the caller just uploads under track.id. */
export async function insertBgmTrack(
  input: { name: string },
  owner: { id: string; name: string },
): Promise<BgmTrack> {
  await ensureSchema();
  const id = newId();
  const track: BgmTrack = {
    id,
    name: input.name.trim() || "배경음악",
    key: `bgm/${id}.mp3`,
    ownerId: owner.id,
    ownerName: owner.name,
    createdAt: Date.now(),
  };
  await db.execute({
    sql: `INSERT INTO bgm_tracks (id, name, key, owner_id, owner_name, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      track.id,
      track.name,
      track.key,
      track.ownerId,
      track.ownerName,
      track.createdAt,
    ],
  });
  return track;
}

export async function deleteBgmTrack(id: string): Promise<void> {
  await ensureSchema();
  await db.execute({ sql: `DELETE FROM bgm_tracks WHERE id = ?`, args: [id] });
}
