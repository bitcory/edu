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

/** Admin: every user's 임시저장(draft) books. */
export async function listDraftBooks(): Promise<StoreBook[]> {
  return listByScope("drafts");
}

export async function getBook(id: string): Promise<StoreBook | null> {
  const res = await fetch(`/api/books/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { book: StoreBook; snapshotUrl?: string };
  const book = data.book ?? null;
  // Editor pages come as a presigned R2 URL — download the heavy snapshot
  // straight from R2 (free egress) instead of through the API route.
  if (book && data.snapshotUrl && book.pages.length === 0) {
    try {
      const snap = await fetch(data.snapshotUrl);
      if (!snap.ok) throw new Error(`snapshot ${snap.status}`);
      book.pages = (await snap.json()) as StoreBook["pages"];
    } catch {
      // Direct R2 fetch blocked (likely bucket CORS) — fall back to the
      // server inlining the snapshot like before.
      const inline = await fetch(`/api/books/${id}?inline=1`, {
        cache: "no-store",
      });
      if (!inline.ok) return null;
      const d = (await inline.json()) as { book: StoreBook };
      return d.book ?? null;
    }
  }
  return book;
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
    storyText?: string;
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
  storyText?: string;
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
    cover?: string; // custom cover thumbnail (data URL)
  },
): Promise<StoreBook> {
  const { cover, ...rest } = patch;
  const res = await fetch(`/api/books/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...rest, coverThumb: cover }),
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

/** Use a shared-pool track as the book's music (references it, no copy). */
export async function attachBookAudioFromPool(
  id: string,
  trackId: string,
): Promise<void> {
  const res = await fetch(`/api/books/${id}/audio/from-pool`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ trackId }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "공용 음악 적용에 실패했어요."));
  }
}

/** Presigned URL to play a book's background music; null if none/forbidden. */
export async function getBookAudioUrl(id: string): Promise<string | null> {
  const res = await fetch(`/api/books/${id}/audio-url`, { cache: "no-store" });
  if (!res.ok) return null;
  const { url } = (await res.json()) as { url: string };
  return url ?? null;
}

// ---- Per-page narration ----

/** Upload a page's narration MP3. */
export async function uploadNarration(
  bookId: string,
  index: number,
  file: File,
): Promise<void> {
  if (file.size > 30 * 1024 * 1024) {
    throw new Error("음성 파일이 너무 커요 (최대 30MB).");
  }
  const res = await fetch(`/api/books/${bookId}/narration`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ index }),
  });
  if (res.status === 404) {
    throw new Error(
      "책이 아직 저장되지 않았어요. 상단의 '임시저장'을 한 번 누른 뒤 다시 시도해 주세요.",
    );
  }
  if (!res.ok) {
    throw new Error(await errorMessage(res, "나레이션 등록에 실패했어요."));
  }
  const { uploadUrl } = (await res.json()) as { uploadUrl: string };
  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "content-type": "audio/mpeg" },
  });
  if (!put.ok) {
    throw new Error("음성 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.");
  }
}

export async function removeNarration(
  bookId: string,
  index: number,
): Promise<void> {
  const res = await fetch(`/api/books/${bookId}/narration?index=${index}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "나레이션 삭제에 실패했어요."));
  }
}

/** Presigned narration URLs per page index (null where none). */
export async function getNarrationUrls(
  bookId: string,
): Promise<(string | null)[]> {
  const res = await fetch(`/api/books/${bookId}/narration-urls`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const { urls } = (await res.json()) as { urls: (string | null)[] };
  return urls ?? [];
}

// ---- Shared background-music pool ----

export type BgmPoolTrack = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  /** R2 key (bgm/<id>.mp3) — used to tell which track a book references. */
  key: string;
  url: string;
};

/** List the shared BGM pool (with presigned stream URLs). */
export async function listBgmPool(): Promise<BgmPoolTrack[]> {
  const res = await fetch("/api/bgm", { cache: "no-store" });
  if (!res.ok) return [];
  const { tracks } = (await res.json()) as { tracks: BgmPoolTrack[] };
  return tracks ?? [];
}

/** Upload an MP3 to the shared pool. */
export async function uploadBgmTrack(file: File, name: string): Promise<void> {
  if (file.size > 30 * 1024 * 1024) {
    throw new Error("음악 파일이 너무 커요 (최대 30MB).");
  }
  const res = await fetch("/api/bgm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
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

export async function deleteBgmTrack(id: string): Promise<void> {
  const res = await fetch(`/api/bgm/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "배경음악 삭제에 실패했어요."));
  }
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

/** Log that the current user read this book (for the monthly author
 *  settlement). Fire-and-forget — never blocks or interrupts reading. */
export async function recordBookRead(id: string): Promise<void> {
  try {
    await fetch(`/api/books/${id}/read`, { method: "POST" });
  } catch {
    /* ignore */
  }
}

export type BookReads = {
  bookId: string;
  title: string;
  reads: number; // this month
  totalReads: number; // cumulative
};
export type AuthorSettlement = {
  userId: string;
  name: string;
  reads: number; // this month (payout base)
  totalReads: number; // cumulative 조회수
  share: number; // author % (platform keeps 100 − share)
  books: BookReads[];
};
export type Settlement = {
  period: string;
  totalReads: number; // this month total
  totalAllReads: number; // cumulative total
  authors: AuthorSettlement[];
};

/** Admin: monthly read-based settlement for `period` ('YYYY-MM'). */
export async function getSettlement(period: string): Promise<Settlement> {
  const res = await fetch(`/api/admin/settlement?period=${period}`, {
    cache: "no-store",
  });
  if (!res.ok) return { period, totalReads: 0, totalAllReads: 0, authors: [] };
  return (await res.json()) as Settlement;
}

/** Admin: set one author's revenue-share percent (0–100). */
export async function setAuthorShare(
  userId: string,
  share: number,
): Promise<void> {
  const res = await fetch(`/api/admin/settlement`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, share }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "작가 비율을 수정하지 못했어요."));
  }
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
