"use client";

import { useState } from "react";
import { formatPrice } from "../lib/format-price";
import { computeSettlement } from "../lib/settlement";
import type { AuthorType } from "../lib/author-types";

export type SubmitValues = {
  title: string;
  author: string;
  description: string;
  price: number;
};

type Props = {
  initial?: Partial<SubmitValues>;
  submitting?: boolean;
  authorType?: AuthorType; // when known, show an estimated payout breakdown
  onConfirm: (values: SubmitValues) => void;
  onCancel: () => void;
};

export default function SubmitBookModal({
  initial,
  submitting = false,
  authorType,
  onConfirm,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "내 그림책");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState<string>(
    initial?.price != null ? String(initial.price) : "0",
  );

  const priceNum = Math.max(0, Math.floor(Number(price) || 0));

  const submit = () => {
    if (!title.trim()) {
      alert("책 제목을 적어 주세요.");
      return;
    }
    onConfirm({
      title: title.trim(),
      author: author.trim(),
      description: description.trim(),
      price: priceNum,
    });
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h2 className="modal-title">북스토어에 올리기</h2>

        <label className="modal-field">
          <span className="modal-label">제목</span>
          <input
            className="modal-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
          />
        </label>

        <label className="modal-field">
          <span className="modal-label">지은이 (선택)</span>
          <input
            className="modal-input"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="비워두면 내 이름으로 올라가요"
            maxLength={40}
          />
        </label>

        <label className="modal-field">
          <span className="modal-label">간략한 내용 (선택)</span>
          <textarea
            className="modal-input modal-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="어떤 이야기인지 짧게 소개해 주세요"
          />
        </label>

        <label className="modal-field">
          <span className="modal-label">구매가격 (원)</span>
          <input
            className="modal-input"
            type="number"
            min={0}
            step={100}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <span className="modal-hint">{formatPrice(priceNum)} · 0이면 무료</span>
        </label>

        {authorType && priceNum > 0 && (
          <SettlementPreview price={priceNum} type={authorType} />
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="modal-btn modal-btn--ghost"
            onClick={onCancel}
            disabled={submitting}
          >
            취소
          </button>
          <button
            type="button"
            className="modal-btn modal-btn--primary"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "올리는 중…" : "올리기"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettlementPreview({
  price,
  type,
}: {
  price: number;
  type: AuthorType;
}) {
  const s = computeSettlement(price, type);
  const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
  return (
    <div className="settlement">
      <div className="settlement__title">예상 정산 (표시용)</div>
      <div className="settlement__row">
        <span>판매가</span>
        <span>{won(s.price)}</span>
      </div>
      <div className="settlement__row settlement__row--minus">
        <span>수수료 (카드 포함, 20%)</span>
        <span>-{won(s.commission)}</span>
      </div>
      {type === "individual" && (
        <div className="settlement__row settlement__row--minus">
          <span>원천징수 (3.3%)</span>
          <span>-{won(s.withholding)}</span>
        </div>
      )}
      <div className="settlement__row settlement__row--total">
        <span>지급 예상액</span>
        <span>{won(s.payout)}</span>
      </div>
      {type === "business" && (
        <div className="settlement__note">
          지급액 중 공급가액 {won(s.supply)} · 부가세 {won(s.vat)} (세금계산서
          기준, 확정 전)
        </div>
      )}
    </div>
  );
}
