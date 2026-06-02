"use client";

import type { EditorPage } from "./editor-types";
import type { BookLayout } from "./book-types";

// Drafts are kept in IndexedDB, not localStorage. A book's pages embed full-res
// scan images as base64 inside the Fabric canvas JSON, so a couple of real pages
// blow past localStorage's ~5MB quota (QuotaExceededError → silent 임시저장 loss).
// IndexedDB's quota is disk-proportional (hundreds of MB+), so drafts actually
// persist now.
const DB_NAME = "tbbookviewer";
const DB_VERSION = 1;
const STORE = "editor";
const STATE_KEY = "v1";
// Legacy localStorage key we migrate away from on first load.
const LEGACY_KEY = "tbbookviewer:editor:v1";
// The cloud-draft id this local working draft maps to, so navigating away and
// back keeps updating the SAME draft instead of creating a new one each time.
// Tiny string → plain localStorage is fine (no quota concern).
const DRAFT_ID_KEY = "tbbookviewer:editor:draftId";

export type StoredState = {
  pages: EditorPage[];
  activeIndex: number;
  savedAt: number;
  pageW?: number; // 판형 가로폭 (없으면 기본 800)
  layout?: BookLayout;
};

function isValidState(parsed: unknown): parsed is StoredState {
  const s = parsed as StoredState | null;
  return (
    !!s && Array.isArray(s.pages) && typeof s.activeIndex === "number"
  );
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDB().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbSet(key: string, value: unknown): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

function idbDelete(key: string): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

// One-time lift of an existing localStorage draft into IndexedDB, then drop the
// localStorage copy to reclaim its quota. Best-effort: any failure just means we
// fall through to "no draft".
async function migrateLegacy(): Promise<StoredState | null> {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!isValidState(parsed)) {
      window.localStorage.removeItem(LEGACY_KEY);
      return null;
    }
    await idbSet(STATE_KEY, parsed);
    window.localStorage.removeItem(LEGACY_KEY);
    return parsed;
  } catch (err) {
    console.warn("editor-storage: legacy migration failed", err);
    return null;
  }
}

export async function loadEditorState(): Promise<StoredState | null> {
  if (typeof window === "undefined") return null;
  try {
    const stored = await idbGet<StoredState>(STATE_KEY);
    if (isValidState(stored)) return stored;
    // Nothing in IndexedDB yet — pull a legacy localStorage draft across.
    return await migrateLegacy();
  } catch (err) {
    console.warn("editor-storage: load failed", err);
    return null;
  }
}

export async function saveEditorState(state: StoredState): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    await idbSet(STATE_KEY, state);
    return true;
  } catch (err) {
    console.warn("editor-storage: save failed", err);
    return false;
  }
}

export async function clearEditorState(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await idbDelete(STATE_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.removeItem(LEGACY_KEY);
    window.localStorage.removeItem(DRAFT_ID_KEY);
  } catch {
    /* ignore */
  }
}

// ---- Local working-draft id ----
// Maps the local working draft to its cloud draft row so round-trips (편집기 →
// 내서재 → 편집기) keep updating the same draft instead of spawning new ones.

export function loadDraftId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(DRAFT_ID_KEY);
  } catch {
    return null;
  }
}

export function saveDraftId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_ID_KEY, id);
  } catch {
    /* ignore */
  }
}
