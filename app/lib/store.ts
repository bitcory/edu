"use client";

import type {
  BookScope,
  StoreBook,
  SubmitInput,
} from "./book-types";

export type { BookStatus, StoreBook, SubmitInput } from "./book-types";

/**
 * Bookstore data access. These call the Next.js API routes (which persist to
 * libSQL and authorize via the Clerk session). Same-origin fetch carries the
 * Clerk session cookie automatically, so no auth header is needed — the server
 * derives the user with getServerUser().
 */

async function listByScope(scope: BookScope): Promise<StoreBook[]> {
  const res = await fetch(`/api/books?scope=${scope}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { books: StoreBook[] };
  return data.books ?? [];
}

export async function listStoreBooks(): Promise<StoreBook[]> {
  return listByScope("store");
}

export async function listMyBooks(): Promise<StoreBook[]> {
  return listByScope("mine");
}

export async function listPendingBooks(): Promise<StoreBook[]> {
  return listByScope("pending");
}

export async function listRejectedBooks(): Promise<StoreBook[]> {
  return listByScope("rejected");
}

export async function getBook(id: string): Promise<StoreBook | null> {
  const res = await fetch(`/api/books/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { book: StoreBook };
  return data.book ?? null;
}

export async function submitBook(input: SubmitInput): Promise<StoreBook> {
  const { pages, ...meta } = input;
  const snap = await snapshotBody(pages);
  const res = await fetch("/api/books", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...meta, ...snap }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "책을 올리지 못했어요."));
  }
  const data = (await res.json()) as { book: StoreBook };
  return data.book;
}

export async function updateBook(
  id: string,
  patch: {
    pages: SubmitInput["pages"];
    title?: string;
    description?: string;
    price?: number;
    pageW?: number;
    layout?: StoreBook["layout"];
  },
): Promise<StoreBook> {
  const { pages, ...meta } = patch;
  const snap = await snapshotBody(pages);
  const res = await fetch(`/api/books/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...meta, ...snap }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "책을 수정하지 못했어요."));
  }
  const data = (await res.json()) as { book: StoreBook };
  return data.book;
}

/** Register an uploaded PDF as a private (draft) book in my library. */
export async function registerPdfBook(
  file: File,
  title: string,
  coverThumb?: string,
): Promise<StoreBook> {
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("파일이 너무 커요 (최대 50MB).");
  }
  // 1) Create the draft row + get a presigned R2 upload URL.
  const res = await fetch("/api/books/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, coverThumb }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "내 서재 등록에 실패했어요."));
  }
  const { book, uploadUrl } = (await res.json()) as {
    book: StoreBook;
    uploadUrl: string;
  };
  // 2) Upload the bytes straight to R2 (skips the serverless body limit).
  const put = await fetch(uploadUrl, { method: "PUT", body: file });
  if (!put.ok) {
    throw new Error("PDF 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.");
  }
  return book;
}

// Editor snapshots can carry big embedded images. Anything over ~3MB would
// blow Vercel's request-body limit, so upload it straight to R2 (presigned)
// and reference it by key; smaller snapshots go inline.
const SNAPSHOT_INLINE_LIMIT = 3_000_000;

async function snapshotBody(
  pages: SubmitInput["pages"],
): Promise<{ pages: SubmitInput["pages"] } | { snapshotKey: string }> {
  const json = JSON.stringify(pages);
  if (json.length <= SNAPSHOT_INLINE_LIMIT) return { pages };
  const res = await fetch("/api/books/snapshot-upload", { method: "POST" });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "저장 준비에 실패했어요."));
  }
  const { key, url } = (await res.json()) as { key: string; url: string };
  const put = await fetch(url, {
    method: "PUT",
    body: json,
    headers: { "content-type": "application/json" },
  });
  if (!put.ok) {
    throw new Error("그림이 많아 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.");
  }
  return { snapshotKey: key };
}

/** 임시저장: save the editor book as a private draft (no publish). With an
 * `id` it updates that draft; without, it creates a new one and returns it
 * (the caller should adopt the returned id so further saves update the same
 * draft). */
export async function saveDraft(input: {
  id?: string;
  pages: SubmitInput["pages"];
  title?: string;
  description?: string;
  price?: number;
  pageW?: number;
  layout?: SubmitInput["layout"];
}): Promise<StoreBook> {
  const { pages, ...meta } = input;
  const snap = await snapshotBody(pages);
  const res = await fetch("/api/books/draft", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...meta, ...snap }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "임시저장에 실패했어요."));
  }
  const data = (await res.json()) as { book: StoreBook };
  return data.book;
}

/** Edit only title/price/description (no content change, status unchanged). */
export async function updateBookInfo(
  id: string,
  patch: { title?: string; price?: number; description?: string },
): Promise<StoreBook> {
  const res = await fetch(`/api/books/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "수정하지 못했어요."));
  }
  const data = (await res.json()) as { book: StoreBook };
  return data.book;
}

export async function deleteBook(id: string): Promise<void> {
  const res = await fetch(`/api/books/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "삭제하지 못했어요."));
  }
}

export async function approveBook(id: string): Promise<void> {
  await fetch(`/api/books/${id}/approve`, { method: "POST" });
}

export async function rejectBook(id: string, reason?: string): Promise<void> {
  await fetch(`/api/books/${id}/reject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}
