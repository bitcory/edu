import type { EditorPage } from "./editor-types";

// Neutral (no "use client") so both client store.ts and server route handlers
// can share these types.

export type BookStatus = "draft" | "pending" | "approved" | "rejected";

// "editor" = Fabric snapshot (pages). "pdf" = uploaded PDF stored on disk/R2.
export type BookKind = "editor" | "pdf";

// Reading layout: 양면(펼침) vs 단면(한 쪽씩).
export type BookLayout = "spread" | "single";

export type StoreBook = {
  id: string;
  title: string;
  kind: BookKind;
  author?: string;
  description?: string; // 간략한 내용
  category?: string; // 카테고리 (그림책/소설/시/강의자료 …)
  price: number; // 구매가격, 원(₩) 정수. 0 = 무료
  pageW: number; // 판형 가로폭 (높이는 PAGE_H 고정)
  layout: BookLayout;
  ownerId: string;
  ownerName: string;
  pages: EditorPage[]; // Fabric snapshot — empty unless hydrated from R2
  snapshotKey?: string; // R2 key holding the full pages JSON (editor books)
  pageCount?: number; // page count (kept on the row so lists needn't load pages)
  coverThumb?: string; // presigned R2 URL on reads (legacy books: data URL)
  coverKey?: string; // R2 key of the cover image (covers/<id>.jpg)
  pdfUrl?: string; // filled by the future server (R2); undefined for now
  status: BookStatus;
  submittedAt: number;
  reviewedAt?: number;
  rejectReason?: string;
  likeCount?: number; // populated by the store listing (좋아요 수)
  audioKey?: string; // R2 key of the background music (MP3), if any
  narration?: (string | null)[]; // R2 key per page index (null = no narration)
  storyText?: string; // raw 내용추가 script, so re-edits reload the textarea
};

export type SubmitInput = {
  title: string;
  author?: string;
  description?: string;
  category?: string;
  price: number;
  pageW: number;
  layout: BookLayout;
  pages: EditorPage[];
  coverThumb?: string; // optional custom cover (else derived from pages[0])
  storyText?: string; // raw 내용추가 script
};

export type BookScope = "store" | "mine" | "pending" | "rejected" | "drafts";

export type BookComment = {
  id: string;
  bookId: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: number;
};

export type BookSocial = {
  likeCount: number;
  liked: boolean; // whether the current user liked it
  comments: BookComment[];
};
