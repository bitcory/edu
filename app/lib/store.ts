"use client";

import type {
  BookComment,
  BookScope,
  BookSocial,
  StoreBook,
  SubmitInput,
} from "./book-types";

export type {
  BookComment,
  BookSocial,
  BookStatus,
  StoreBook,
  SubmitInput,
} from "./book-types";

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
    author?: string;
    description?: string;
    category?: string;
    price?: number;
    pageW?: number;
    layout?: StoreBook["layout"];
    coverThumb?: string;
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
  meta: {
    title: string;
    author?: string;
    coverThumb?: string;
    description?: string;
    category?: string;
    price?: number;
  },
): Promise<StoreBook> {
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("파일이 너무 커요 (최대 50MB).");
  }
  // 1) Create the draft row + get a presigned R2 upload URL.
  const res = await fetch("/api/books/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(meta),
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
  patch: {
    title?: string;
    author?: string;
    price?: number;
    description?: string;
    category?: string;
  },
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

// ---- Background music (MP3) ----

/** Upload an MP3 as a book's background music (owner/admin). */
export async function attachBookAudio(id: string, file: File): Promise<void> {
  if (file.size > 30 * 1024 * 1024) {
    throw new Error("음악 파일이 너무 커요 (최대 30MB).");
  }
  const res = await fetch(`/api/books/${id}/audio`, { method: "POST" });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "배경음악 등록에 실패했어요."));
  }
  const { uploadUrl } = (await res.json()) as { uploadUrl: string };
  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "content-type": "audio/mpeg" },
  });
  if (!put.ok) {
    throw new Error("음악 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.");
  }
}

export async function removeBookAudio(id: string): Promise<void> {
  const res = await fetch(`/api/books/${id}/audio`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "배경음악 제거에 실패했어요."));
  }
}

/** Presigned URL to play a book's background music; null if none/forbidden. */
export async function getBookAudioUrl(id: string): Promise<string | null> {
  const res = await fetch(`/api/books/${id}/audio-url`, { cache: "no-store" });
  if (!res.ok) return null;
  const { url } = (await res.json()) as { url: string };
  return url ?? null;
}

// ---- Likes + comments (preview modal) ----

export async function getBookSocial(id: string): Promise<BookSocial> {
  const res = await fetch(`/api/books/${id}/social`, { cache: "no-store" });
  if (!res.ok) return { likeCount: 0, liked: false, comments: [] };
  return (await res.json()) as BookSocial;
}

export async function toggleBookLike(
  id: string,
): Promise<{ liked: boolean; likeCount: number }> {
  const res = await fetch(`/api/books/${id}/like`, { method: "POST" });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "좋아요에 실패했어요."));
  }
  return (await res.json()) as { liked: boolean; likeCount: number };
}

export async function addBookComment(
  id: string,
  body: string,
): Promise<BookComment> {
  const res = await fetch(`/api/books/${id}/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "댓글 작성에 실패했어요."));
  }
  const data = (await res.json()) as { comment: BookComment };
  return data.comment;
}

export async function deleteBookComment(
  id: string,
  commentId: string,
): Promise<void> {
  const res = await fetch(`/api/books/${id}/comments`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ commentId }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "댓글 삭제에 실패했어요."));
  }
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}
