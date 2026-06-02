"use client";

import type {
  Author,
  AuthorApplyInput,
  AuthorCard,
  PublicAuthor,
} from "./author-types";
import type { StoreBook } from "./store";

/** Client access to the author API (Clerk session via cookie). */

/** Public author profile + their approved books (most liked first). null when
 *  the author doesn't exist or isn't approved. */
export async function fetchAuthorProfile(
  userId: string,
): Promise<{ author: PublicAuthor; books: StoreBook[] } | null> {
  const res = await fetch(`/api/authors/${userId}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as { author: PublicAuthor; books: StoreBook[] };
}

/** All approved authors (PII-free) for the 작가 선택 picker. */
export async function fetchAuthorDirectory(): Promise<AuthorCard[]> {
  const res = await fetch("/api/authors/directory", { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { authors: AuthorCard[] };
  return data.authors ?? [];
}

export async function fetchMyAuthor(): Promise<Author | null> {
  const res = await fetch("/api/authors/me", { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { author: Author | null };
  return data.author ?? null;
}

export async function applyAuthor(input: AuthorApplyInput): Promise<Author> {
  const res = await fetch("/api/authors/me", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "작가 등록에 실패했어요.");
  }
  const data = (await res.json()) as { author: Author };
  return data.author;
}

export async function fetchAuthors(
  scope: "pending" | "approved" | "rejected",
): Promise<Author[]> {
  const res = await fetch(`/api/authors?scope=${scope}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { authors: Author[] };
  return data.authors ?? [];
}

export async function fetchPendingAuthors(): Promise<Author[]> {
  return fetchAuthors("pending");
}

export async function approveAuthor(userId: string): Promise<void> {
  await fetch(`/api/authors/${userId}/approve`, { method: "POST" });
}

export async function rejectAuthor(
  userId: string,
  reason?: string,
): Promise<void> {
  await fetch(`/api/authors/${userId}/reject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}
