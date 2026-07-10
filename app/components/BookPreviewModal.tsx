"use client";

import { useEffect, useState } from "react";
import { BookOpen, Heart, Send, Trash2, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useIsAdmin } from "./auth/useIsAdmin";
import { formatPrice } from "../lib/format-price";
import {
  addBookComment,
  deleteBookComment,
  getBookSocial,
  toggleBookLike,
  type BookComment,
  type StoreBook,
} from "../lib/store";

type Props = {
  book: StoreBook;
  onClose: () => void;
  onRead: () => void;
  onLikeChange?: (likeCount: number) => void;
};

export default function BookPreviewModal({
  book,
  onClose,
  onRead,
  onLikeChange,
}: Props) {
  const user = useSession().data?.user;
  const { isAdmin } = useIsAdmin();
  // Seed from the card's count so opening the modal doesn't flash 0 → real
  // value before getBookSocial resolves; the effect below refines it.
  const [likeCount, setLikeCount] = useState(book.likeCount ?? 0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<BookComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  // Close on Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    getBookSocial(book.id).then((s) => {
      if (cancelled) return;
      setLikeCount(s.likeCount);
      setLiked(s.liked);
      setComments(s.comments);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [book.id]);

  const onLike = async () => {
    const wasLiked = liked;
    // optimistic
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    try {
      const r = await toggleBookLike(book.id);
      setLiked(r.liked);
      setLikeCount(r.likeCount);
      onLikeChange?.(r.likeCount);
    } catch (err) {
      setLiked(wasLiked);
      setLikeCount((c) => c + (wasLiked ? 1 : -1));
      alert((err as Error).message);
    }
  };

  const submitComment = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const c = await addBookComment(book.id, text);
      setComments((prev) => [...prev, c]);
      setDraft("");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeComment = async (c: BookComment) => {
    if (!confirm("댓글을 삭제할까요?")) return;
    try {
      await deleteBookComment(book.id, c.id);
      setComments((prev) => prev.filter((x) => x.id !== c.id));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="preview-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="preview-close"
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={20} />
        </button>

        <div className="preview-head">
          <div className="preview-cover">
            {book.coverThumb ? (
              <img src={book.coverThumb} alt={book.title} />
            ) : (
              <span>표지</span>
            )}
          </div>
          <div className="preview-info">
            <h2 className="preview-title">{book.title}</h2>
            <p className="preview-author">
              {book.author ?? book.ownerName}
              {book.category && (
                <span className="store-card__cat">{book.category}</span>
              )}
            </p>
            <p className="preview-price">{formatPrice(book.price)}</p>
            {book.description && (
              <p className="preview-desc">{book.description}</p>
            )}
            <div className="preview-actions">
              <button
                type="button"
                className="preview-read"
                onClick={onRead}
              >
                <BookOpen size={16} /> 읽어보기
              </button>
              <button
                type="button"
                className={`preview-like${liked ? " is-liked" : ""}`}
                onClick={() => void onLike()}
                aria-pressed={liked}
                aria-label="좋아요"
              >
                <Heart size={16} fill={liked ? "currentColor" : "none"} />
                {likeCount}
              </button>
            </div>
          </div>
        </div>

        <div className="preview-comments">
          <h3 className="preview-comments__title">
            댓글{comments.length > 0 ? ` ${comments.length}` : ""}
          </h3>
          {loading ? (
            <p className="preview-muted">불러오는 중…</p>
          ) : comments.length === 0 ? (
            <p className="preview-muted">
              아직 댓글이 없어요. 첫 댓글을 남겨 보세요!
            </p>
          ) : (
            <ul className="preview-comment-list">
              {comments.map((c) => (
                <li key={c.id} className="preview-comment">
                  <div className="preview-comment__head">
                    <span className="preview-comment__name">{c.userName}</span>
                    {(c.userId === user?.id || isAdmin) && (
                      <button
                        type="button"
                        className="preview-comment__del"
                        onClick={() => void removeComment(c)}
                        aria-label="댓글 삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <p className="preview-comment__body">{c.body}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="preview-comment-form">
            <input
              className="preview-comment-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitComment();
                }
              }}
              placeholder="댓글을 입력하세요"
              maxLength={1000}
            />
            <button
              type="button"
              className="preview-comment-send"
              onClick={() => void submitComment()}
              disabled={busy || !draft.trim()}
              aria-label="댓글 작성"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
