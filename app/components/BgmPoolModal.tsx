"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Music, Trash2, Upload, X } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useIsAdmin } from "./auth/useIsAdmin";
import {
  deleteBgmTrack,
  listBgmPool,
  uploadBgmTrack,
  type BgmPoolTrack,
} from "../lib/store";

type Props = {
  onClose: () => void;
};

/**
 * Manage the shared background-music pool: anyone can listen to / add tracks;
 * the uploader (or an admin) can delete. A random pool track plays when a book
 * without its own music is opened.
 */
export default function BgmPoolModal({ onClose }: Props) {
  const { user } = useUser();
  const { isAdmin } = useIsAdmin();
  const [tracks, setTracks] = useState<BgmPoolTrack[] | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(() => {
    listBgmPool().then(setTracks);
  }, []);
  useEffect(() => refresh(), [refresh]);

  const onPick = useCallback(
    async (file: File) => {
      const name = file.name.replace(/\.[^.]+$/, "");
      setBusy(true);
      try {
        await uploadBgmTrack(file, name);
        refresh();
      } catch (e) {
        alert((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const onDelete = useCallback(
    async (t: BgmPoolTrack) => {
      if (!window.confirm(`"${t.name}"을(를) 삭제할까요?`)) return;
      setBusy(true);
      try {
        await deleteBgmTrack(t.id);
        refresh();
      } catch (e) {
        alert((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const canDelete = (t: BgmPoolTrack) => isAdmin || t.ownerId === user?.id;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="bgm-head">
          <h2 className="modal-title">공용 배경음악</h2>
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
          여기 올린 곡은 책을 열 때 랜덤으로 잔잔하게 재생돼요. (책에 직접 올린
          음악이 있으면 그 곡이 우선)
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPick(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="modal-btn modal-btn--primary bgm-upload"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <Upload size={16} /> {busy ? "올리는 중…" : "MP3 올리기"}
        </button>

        <div className="bgm-list">
          {tracks === null ? (
            <p className="modal-hint">불러오는 중…</p>
          ) : tracks.length === 0 ? (
            <p className="modal-hint">아직 올라온 음악이 없어요. 첫 곡을 올려보세요!</p>
          ) : (
            tracks.map((t) => (
              <div key={t.id} className="bgm-row">
                <Music size={16} className="bgm-row__icon" />
                <div className="bgm-row__info">
                  <span className="bgm-row__name">{t.name}</span>
                  <span className="bgm-row__by">{t.ownerName}</span>
                </div>
                <audio src={t.url} controls preload="none" className="bgm-row__audio" />
                {canDelete(t) && (
                  <button
                    type="button"
                    className="icon-btn icon-btn--delete"
                    onClick={() => void onDelete(t)}
                    disabled={busy}
                    title="삭제"
                    aria-label="삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
