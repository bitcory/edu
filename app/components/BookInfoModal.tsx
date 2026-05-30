"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { formatPrice } from "../lib/format-price";
import { BOOK_CATEGORIES, DEFAULT_CATEGORY } from "../lib/categories";
import { fileToThumb } from "../lib/thumbnail";

export type InfoValues = {
  title: string;
  author: string;
  price: number;
  description: string;
  category: string;
  cover?: string;
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
  const [cover, setCover] = useState<string | undefined>(initial.cover);
  const [price, setPrice] = useState<string>(String(initial.price ?? 0));
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const priceNum = Math.max(0, Math.floor(Number(price) || 0));

  const pickCover = async (file: File) => {
    const thumb = await fileToThumb(file);
    if (thumb) setCover(thumb);
  };

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
      cover,
    });
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h2 className="modal-title">책 정보 수정</h2>

        <div className="modal-field">
          <span className="modal-label">표지 이미지</span>
          <button
            type="button"
            className="cover-pick"
            onClick={() => coverInputRef.current?.click()}
            title="표지로 쓸 이미지를 고르세요"
          >
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="표지 미리보기" className="cover-pick__img" />
            ) : (
              <span className="cover-pick__empty">
                <ImagePlus size={22} />
                표지 고르기
              </span>
            )}
            <span className="cover-pick__hint">눌러서 변경</span>
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickCover(f);
              e.target.value = "";
            }}
          />
        </div>

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
