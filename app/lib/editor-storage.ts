"use client";

import type { EditorPage } from "./editor-types";

const STORAGE_KEY = "tbbookviewer:editor:v1";

export type StoredState = {
  pages: EditorPage[];
  activeIndex: number;
  savedAt: number;
};

export function loadEditorState(): StoredState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredState;
    if (
      !parsed ||
      !Array.isArray(parsed.pages) ||
      typeof parsed.activeIndex !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn("editor-storage: load failed", err);
    return null;
  }
}

export function saveEditorState(state: StoredState): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    // Most likely QuotaExceededError when images push the payload past ~5MB.
    console.warn("editor-storage: save failed", err);
    return false;
  }
}

export function clearEditorState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
