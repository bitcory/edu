/**
 * Book categories for the store. Kept as one list so the submit modals, the
 * info-edit modal, and the store filter all stay in sync. Picture-book first
 * since that's the platform's core, then prose, then teaching material.
 */
export const BOOK_CATEGORIES = [
  "그림책",
  "동화",
  "소설",
  "시",
  "에세이",
  "강의자료",
  "만화",
  "기타",
] as const;

export type BookCategory = (typeof BOOK_CATEGORIES)[number];

export const DEFAULT_CATEGORY: BookCategory = "그림책";

/** Coerce arbitrary input to a known category (falls back to the default). */
export function normalizeCategory(value: unknown): BookCategory {
  return (BOOK_CATEGORIES as readonly string[]).includes(value as string)
    ? (value as BookCategory)
    : DEFAULT_CATEGORY;
}
