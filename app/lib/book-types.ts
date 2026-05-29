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
};

export type SubmitInput = {
  title: string;
  author?: string;
  description?: string;
  price: number;
  pageW: number;
  layout: BookLayout;
  pages: EditorPage[];
};

export type BookScope = "store" | "mine" | "pending" | "rejected";
