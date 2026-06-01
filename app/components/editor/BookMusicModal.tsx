"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Music, Upload, X } from "lucide-react";
import {
  attachBookAudio,
  attachBookAudioFromPool,
  listBgmPool,
  removeBookAudio,
  type BgmPoolTrack,
} from "../../lib/store";

type Props = {
  bookId: string;
  /** The book's current audio R2 key (to mark the selected pool track), or null. */
  currentKey?: string | null;
  onClose: () => void;
  /** Called after music changes — passes the new audio key, or null if removed. */
  onChanged: (audioKey: string | null) => void;
};

/**
 * Pick a book's background music: upload your own MP3, or choose from the
 * shared pool (preview each with the player). A pool pick just references the
 * track (no copy → no extra storage); the book streams it straight from R2.
 */
export default function BookMusicModal({
  bookId,
  currentKey,
  onClose,
  onChanged,
}: Props) {
  const [tracks, setTracks] = useState<BgmPoolTrack[] | null>(null);
  const [busy, setBusy] = useState(false);
  // The row the user has clicked (pending), confirmed with the 선택 button.
  const [chosen, setChosen] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const hasAudio = !!currentKey;

  useEffect(() => {
    listBgmPool().then((ts) => {
      setTracks(ts);
      // Pre-highlight the track this book is already using.
      if (currentKey) {
        const cur = ts.find((t) => t.key === currentKey);
        if (cur) setChosen(cur.id);
      }
    });
  }, [currentKey]);

  const chosenTrack = tracks?.find((t) => t.id === chosen) ?? null;
  const chosenIsCurrent = !!chosenTrack && chosenTrack.key === currentKey;

  const onUpload = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        await attachBookAudio(bookId, file);
        onChanged(`audio/${bookId}.mp3`);
        alert("배경음악을 등록했어요! 책을 읽는 동안 잔잔하게 흘러나와요.");
        onClose();
      } catch (e) {
        alert((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [bookId, onChanged, onClose],
  );

  const onSelectPool = useCallback(
    async (t: BgmPoolTrack) => {
      setBusy(true);
      try {
        await attachBookAudioFromPool(bookId, t.id);
        onChanged(t.key);
        alert(`"${t.name}"을(를) 이 책의 배경음악으로 설정했어요!`);
        onClose();
      } catch (e) {
        alert((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [bookId, onChanged, onClose],
  );

  const onRemove = useCallback(async () => {
    if (!window.confirm("이 책의 배경음악을 제거할까요?")) return;
    setBusy(true);
    try {
      await removeBookAudio(bookId);
      onChanged(null);
      onClose();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [bookId, onChanged, onClose]);

  return (
    <div className="ed-cmodal-backdrop" onClick={onClose}>
      <div
        className="ed-cmodal ed-cmodal--music"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ed-cmodal__head">
          <span>🎵 배경음악</span>
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

        <div className="ed-music__body">
          <div className="ed-music__actions">
            <input
              ref={fileRef}
              type="file"
              accept="audio/*,.mp3"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="ed-cmodal__btn ed-cmodal__btn--primary"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              <Upload size={16} /> 내 파일 올리기
            </button>
            {hasAudio && (
              <button
                type="button"
                className="ed-cmodal__btn ed-cmodal__btn--ghost"
                onClick={() => void onRemove()}
                disabled={busy}
              >
                음악 제거
              </button>
            )}
          </div>

          <div className="ed-music__sec">공용음악에서 선택</div>
          <p className="ed-cmodal__hint" style={{ marginTop: 0 }}>
            들어본 뒤 곡을 클릭하면 테두리로 선택돼요. 아래 <b>선택</b> 버튼을
            누르면 이 책의 배경음악으로 설정됩니다. (파일은 따로 저장되지 않고
            공용 곡을 그대로 재생)
          </p>

          <div className="ed-music__list">
            {tracks === null ? (
              <p className="ed-cmodal__hint">불러오는 중…</p>
            ) : tracks.length === 0 ? (
              <p className="ed-cmodal__hint">
                아직 공용음악이 없어요. (공용음악은 내 서재의 &quot;공용
                배경음악&quot;에서 올릴 수 있어요.)
              </p>
            ) : (
              tracks.map((t) => {
                const isCurrent = !!currentKey && currentKey === t.key;
                const isChosen = chosen === t.id;
                return (
                  <div
                    key={t.id}
                    role="button"
                    className={`ed-music__row${isChosen ? " is-chosen" : ""}${
                      isCurrent ? " is-current" : ""
                    }`}
                    onClick={() => setChosen(t.id)}
                  >
                    <Music size={16} className="ed-music__row-icon" />
                    <div className="ed-music__row-info">
                      <span className="ed-music__row-name">
                        {t.name}
                        {isCurrent && (
                          <span className="ed-music__tag">현재 곡</span>
                        )}
                      </span>
                      <span className="ed-music__row-by">{t.ownerName}</span>
                    </div>
                    <audio
                      src={t.url}
                      controls
                      preload="none"
                      className="ed-music__row-audio"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="ed-cmodal__foot">
          <span className="ed-cmodal__count">
            {chosenTrack
              ? chosenIsCurrent
                ? `현재 곡: ${chosenTrack.name}`
                : `선택 대기: ${chosenTrack.name}`
              : "곡을 클릭해 고르세요"}
          </span>
          <button
            type="button"
            className="ed-cmodal__btn ed-cmodal__btn--ghost"
            onClick={onClose}
            disabled={busy}
          >
            취소
          </button>
          <button
            type="button"
            className="ed-cmodal__btn ed-cmodal__btn--primary"
            onClick={() => chosenTrack && void onSelectPool(chosenTrack)}
            disabled={busy || !chosenTrack || chosenIsCurrent}
          >
            <Check size={15} /> 선택
          </button>
        </div>
      </div>
    </div>
  );
}
