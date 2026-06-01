"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Trash2, Upload, X } from "lucide-react";
import {
  getBook,
  getNarrationUrls,
  removeNarration,
  uploadNarration,
  type StoreBook,
} from "../lib/store";

type Props = {
  bookId: string;
  onClose: () => void;
};

/**
 * Per-page narration manager: upload a voice file for each page. When the book
 * is read, each page's narration plays as the reader turns to it.
 */
export default function NarrationModal({ bookId, onClose }: Props) {
  const [book, setBook] = useState<StoreBook | null>(null);
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const [busy, setBusy] = useState<number | null>(null); // page index being uploaded
  const fileRef = useRef<HTMLInputElement | null>(null);
  const targetIndex = useRef<number>(-1);

  const load = useCallback(async () => {
    const [b, u] = await Promise.all([getBook(bookId), getNarrationUrls(bookId)]);
    setBook(b);
    setUrls(u);
  }, [bookId]);
  useEffect(() => {
    void load();
  }, [load]);

  const pick = (index: number) => {
    targetIndex.current = index;
    fileRef.current?.click();
  };

  const onFile = useCallback(
    async (file: File) => {
      const i = targetIndex.current;
      if (i < 0) return;
      setBusy(i);
      try {
        await uploadNarration(bookId, i, file);
        await load();
      } catch (e) {
        alert((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [bookId, load],
  );

  const onDelete = useCallback(
    async (i: number) => {
      setBusy(i);
      try {
        await removeNarration(bookId, i);
        await load();
      } catch (e) {
        alert((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [bookId, load],
  );

  const pages = book?.pages ?? [];

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="bgm-head">
          <h2 className="modal-title">
            <Mic size={18} style={{ verticalAlign: "-3px", marginRight: 6 }} />
            나레이션
          </h2>
          <button type="button" className="cp-close" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <p className="modal-hint" style={{ marginTop: 0 }}>
          페이지마다 음성을 올리면, 책을 넘길 때 그 페이지에서 자동으로 재생돼요.
          (자동보기에선 음성이 끝나면 다음 장으로 넘어가요)
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />

        <div className="narr-list">
          {book === null ? (
            <p className="modal-hint">불러오는 중…</p>
          ) : pages.length === 0 ? (
            <p className="modal-hint">페이지가 없어요.</p>
          ) : (
            pages.map((p, i) => {
              const url = urls[i] ?? null;
              return (
                <div key={i} className="narr-row">
                  <div className="narr-row__thumb">
                    {p.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumb} alt={`${i + 1}쪽`} />
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </div>
                  <span className="narr-row__no">{i + 1}쪽</span>
                  {url ? (
                    <audio src={url} controls preload="none" className="narr-row__audio" />
                  ) : (
                    <span className="narr-row__empty">음성 없음</span>
                  )}
                  <button
                    type="button"
                    className="icon-btn icon-btn--edit"
                    onClick={() => pick(i)}
                    disabled={busy !== null}
                    title={url ? "음성 교체" : "음성 올리기"}
                    aria-label="음성 올리기"
                  >
                    <Upload size={15} />
                  </button>
                  {url && (
                    <button
                      type="button"
                      className="icon-btn icon-btn--delete"
                      onClick={() => void onDelete(i)}
                      disabled={busy !== null}
                      title="삭제"
                      aria-label="삭제"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                  {busy === i && <span className="narr-row__busy">…</span>}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
