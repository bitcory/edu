"use client";

import { X } from "lucide-react";

export type CaptionPageCell = {
  /** Page id. */
  id: string;
  /** Page index in the editor. */
  index: number;
  /** Display label, e.g. "1쪽". */
  label: string;
  thumb?: string;
  /** Right page of a spread → caption defaults to the top-right. */
  isRight: boolean;
};

export type SpreadRow = {
  /** Unique key for the row (the left page id). */
  key: string;
  left: CaptionPageCell;
  right: CaptionPageCell | null;
};

type Props = {
  spreads: SpreadRow[];
  /** The whole story; blank lines split it into per-page blocks. */
  text: string;
  /** Selected page ids. */
  selected: string[];
  busy?: boolean;
  onToggle: (pageId: string) => void;
  onText: (text: string) => void;
  onApply: () => void;
  onClose: () => void;
};

/** Split a story into blocks on blank lines; trims and drops empty ones. */
export function splitBlocks(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
}

/** Flatten spread rows into the ordered list of page cells (page order). */
export function orderedCells(spreads: SpreadRow[]): CaptionPageCell[] {
  return spreads.flatMap((s) => (s.right ? [s.left, s.right] : [s.left]));
}

/**
 * 내용 추가: spreads are shown on the left with the two pages side by side, but
 * each page is selected individually (multi-select) so you choose whether a
 * block lands on the left or right page. Paste the whole story on the right
 * with blank lines between blocks; 적용 drops each block onto the matching
 * selected page (page order) at its default position — left page → top-left,
 * right page → top-right (the 글자 default). Fine positioning is manual.
 */
export default function ContentTextModal({
  spreads,
  text,
  selected,
  busy,
  onToggle,
  onText,
  onApply,
  onClose,
}: Props) {
  const sel = new Set(selected);
  const blocks = splitBlocks(text);
  const chosen = orderedCells(spreads).filter((c) => sel.has(c.id));

  const renderCell = (cell: CaptionPageCell | null) => {
    if (!cell) return <span className="ed-cmodal__cell ed-cmodal__cell--gap" />;
    const isSel = sel.has(cell.id);
    const order = isSel
      ? chosen.findIndex((c) => c.id === cell.id) + 1
      : 0;
    return (
      <button
        type="button"
        className={`ed-cmodal__cell${isSel ? " is-active" : ""}`}
        onClick={() => onToggle(cell.id)}
      >
        <span className="ed-cmodal__cell-img">
          {cell.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cell.thumb} alt={cell.label} />
          ) : (
            <span className="ed-cmodal__cell-empty" />
          )}
        </span>
        <span className="ed-cmodal__cell-meta">
          <span className="ed-cmodal__cell-label">{cell.label}</span>
          <span className="ed-cmodal__cell-pos">
            {cell.isRight ? "우측 상단" : "좌측 상단"}
          </span>
        </span>
        {isSel && <span className="ed-cmodal__order">{order}</span>}
      </button>
    );
  };

  return (
    <div className="ed-cmodal-backdrop" onClick={onClose}>
      <div className="ed-cmodal" onClick={(e) => e.stopPropagation()}>
        <div className="ed-cmodal__head">
          <span>내용 추가</span>
          <button
            type="button"
            className="ed-cmodal__x"
            onClick={onClose}
            aria-label="닫기"
            title="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {spreads.length === 0 ? (
          <div className="ed-cmodal__empty">
            내용을 넣을 페이지가 없어요. 표지 외에 페이지를 먼저 추가해 주세요.
          </div>
        ) : (
          <div className="ed-cmodal__body">
            <div className="ed-cmodal__list">
              {spreads.map((s) => (
                <div className="ed-cmodal__spread" key={s.key}>
                  {renderCell(s.left)}
                  {renderCell(s.right)}
                </div>
              ))}
            </div>

            <div className="ed-cmodal__detail">
              <div className="ed-cmodal__detail-head">
                <strong>이야기 입력</strong>
                <span className="ed-cmodal__hint">
                  빈 줄로 단락을 나누면, 위에서 선택한 칸에 순서대로 들어갑니다.
                  세부 위치는 적용 후 수동 조정하세요.
                </span>
              </div>
              <textarea
                className="ed-cmodal__textarea"
                value={text}
                placeholder={
                  "여기에 이야기를 붙여넣으세요.\n\n빈 줄로 장면(단락)을 나누면\n선택한 칸에 순서대로 들어갑니다."
                }
                onChange={(e) => onText(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        )}

        <div className="ed-cmodal__foot">
          <span className="ed-cmodal__count">
            선택 {selected.length}칸 · 단락 {blocks.length}개
            {selected.length > 0 &&
              blocks.length > 0 &&
              selected.length !== blocks.length &&
              ` · ${Math.min(selected.length, blocks.length)}개만 적용됨`}
          </span>
          <button
            type="button"
            className="ed-cmodal__btn ed-cmodal__btn--ghost"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className="ed-cmodal__btn ed-cmodal__btn--primary"
            onClick={onApply}
            disabled={busy || selected.length === 0 || blocks.length === 0}
          >
            {busy ? "적용 중…" : "적용"}
          </button>
        </div>
      </div>
    </div>
  );
}
