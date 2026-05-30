"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { formatPrice } from "../lib/format-price";
import { computeSettlement } from "../lib/settlement";
import { BOOK_CATEGORIES, DEFAULT_CATEGORY } from "../lib/categories";
import { fileToThumb } from "../lib/thumbnail";
import type { AuthorType } from "../lib/author-types";

export type SubmitValues = {
  title: string;
  author: string;
  description: string;
  category: string;
  price: number;
  cover?: string;
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
  const [category, setCategory] = useState(
    initial?.category ?? DEFAULT_CATEGORY,
  );
  const [cover, setCover] = useState<string | undefined>(initial?.cover);
  const [price, setPrice] = useState<string>(
    initial?.price != null ? String(initial.price) : "0",
  );
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const priceNum = Math.max(0, Math.floor(Number(price) || 0));

  const pickCover = async (file: File) => {
    const thumb = await fileToThumb(file);
    if (thumb) setCover(thumb);
  };

  const submit = () => {
    if (!title.trim()) {
      alert("책 제목을 적어 주세요.");
      return;
    }
    onConfirm({
      title: title.trim(),
      author: author.trim(),
      description: description.trim(),
      category,
      price: priceNum,
      cover,
    });
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h2 className="modal-title">북스토어에 올리기</h2>

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
