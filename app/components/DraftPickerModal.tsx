"use client";

import { X } from "lucide-react";
import type { StoreBook } from "../lib/book-types";

type Props = {
  drafts: StoreBook[];
  onPick: (draft: StoreBook) => void;
  onClose: () => void;
};

/**
 * Pick which work-in-progress (cloud draft) to publish. Shown when the user
 * has more than one 임시저장 book so "작업중인 책 올리기" no longer guesses.
 */
export default function DraftPickerModal({ drafts, onPick, onClose }: Props) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="bgm-head">
          <h2 className="modal-title">어떤 책을 올릴까요?</h2>
          <button
            type="button"
            className="cp-close"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>
        <p className="modal-hint" style={{ marginTop: 0 }}>
          임시저장된 책 중에서 북스토어에 올릴 책을 골라 주세요.
        </p>

        <div className="draft-pick-list">
          {drafts.map((d) => (
            <button
              key={d.id}
              type="button"
              className="draft-pick"
              onClick={() => onPick(d)}
            >
              <div className="draft-pick__cover">
                {d.coverThumb ?? d.pages[0]?.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.coverThumb ?? d.pages[0]?.thumb}
                    alt={d.title}
                  />
                ) : (
                  <span>표지</span>
                )}
              </div>
              <div className="draft-pick__meta">
                <span className="draft-pick__title">
                  {d.title?.trim() || "제목 없는 책"}
                </span>
                <span className="draft-pick__sub">{d.pages.length}쪽</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
