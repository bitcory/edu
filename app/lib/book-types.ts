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
  pages: EditorPage[]; // Fabric snapshot (editor kind) — empty for pdf kind
  coverThumb?: string; // pages[0].thumb (already a 20% PNG data URL)
  pdfUrl?: string; // filled by the future server (R2); undefined for now
  status: BookStatus;
  submittedAt: number;
  reviewedAt?: number;
  rejectReason?: string;
  likeCount?: number; // populated by the store listing (좋아요 수)
  audioKey?: string; // R2 key of the background music (MP3), if any
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
