"use client";

import { listBgmPool } from "./store";

/**
 * Pick a random track URL from the shared, author-uploaded BGM pool. Used as a
 * fallback when a book has no music of its own. Returns undefined if the pool
 * is empty or the request fails (then the reader simply plays nothing).
 */
export async function pickRandomPoolBgm(): Promise<string | undefined> {
  try {
    const tracks = await listBgmPool();
    if (tracks.length === 0) return undefined;
    const i = Math.floor(Math.random() * tracks.length);
    return tracks[i]?.url;
  } catch {
    return undefined;
  }
}
