"use client";

import { useState } from "react";
import { formatPrice } from "../lib/format-price";
import { BOOK_CATEGORIES, DEFAULT_CATEGORY } from "../lib/categories";

export type InfoValues = {
  title: string;
  author: string;
  price: number;
  description: string;
  category: string;
};

type Props = {
  initial: InfoValues;
  submitting?: boolean;
  onConfirm: (values: InfoValues) => void;
  onCancel: () => void;
};

export default function BookInfoModal({
  initial,
  submitting = false,
  onConfirm,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(initial.title);
  const [author, setAuthor] = useState(initial.author ?? "");
  const [description, setDescription] = useState(initial.description);
  const [category, setCategory] = useState(
    initial.category ?? DEFAULT_CATEGORY,
  );
  const [price, setPrice] = useState<string>(String(initial.price ?? 0));

  const priceNum = Math.max(0, Math.floor(Number(price) || 0));

  const submit = () => {
    if (!title.trim()) {
      alert("제목을 적어 주세요.");
      return;
    }
    onConfirm({
      title: title.trim(),
      author: author.trim(),
      price: priceNum,
      description: description.trim(),
      category,
    });
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h2 className="modal-title">책 정보 수정</h2>

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
          <span className="modal-label">지은이</span>
          <input
            className="modal-input"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="비워두면 내 이름으로 표시돼요"
            maxLength={40}
          />
        </label>

        <label className="modal-field">
          <span className="modal-label">카테고리</span>
          <select
            className="modal-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {BOOK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="modal-field">
          <span className="modal-label">간략한 내용 (선택)</span>
          <textarea
            className="modal-input modal-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={300}
          />
        </label>

        <label className="modal-field">
          <span className="modal-label">가격 (원)</span>
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
            {submitting ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
