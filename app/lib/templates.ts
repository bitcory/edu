import { PAGE_H } from "./editor-types";
import type { BookLayout } from "./book-types";

/**
 * Book 판형(format) presets. Page HEIGHT is fixed at PAGE_H (1000); only the
 * WIDTH changes per format, so the editor/PDF/viewer just need a per-book
 * width. layout = default spread/single for that shape.
 */
export type BookTemplate = {
  id: string;
  label: string;
  width: number; // editor px (height is always PAGE_H)
  layout: BookLayout;
};

export const TEMPLATES: BookTemplate[] = [
  { id: "portrait", label: "세로 그림책", width: 800, layout: "spread" },
  { id: "square", label: "정사각형", width: PAGE_H, layout: "single" },
  { id: "a4", label: "A4 세로", width: Math.round(PAGE_H * (210 / 297)), layout: "spread" },
  { id: "landscape", label: "가로형", width: Math.round(PAGE_H * (4 / 3)), layout: "single" },
];

export const DEFAULT_TEMPLATE = TEMPLATES[0];

export function templateByWidth(width: number): BookTemplate {
  return TEMPLATES.find((t) => t.width === width) ?? DEFAULT_TEMPLATE;
}
