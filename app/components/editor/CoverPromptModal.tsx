"use client";

import { useState } from "react";
import { BookImage, Check, Copy as CopyIcon, X } from "lucide-react";

type Props = {
  /** The full 내용추가 script (captionText) to seed the prompt with. */
  script: string;
  onClose: () => void;
};

// The per-cover instruction appended below the script. The user pastes this
// into an image generator along with an attached photo, so the wording refers
// to "첨부된 이미지/대본".
const FRONT_INSTRUCTION =
  "첨부된 이미지를 첨부된 대본을 바탕으로 그림책 앞표지의 이미지를 만들어줘, 3:4사이즈로 만들어줘";
const BACK_INSTRUCTION =
  "첨부된 이미지를 첨부된 대본을 바탕으로 그림책 뒷표지의 이미지를 만들어줘, 별도의 바코드를 넣어주고 3:4사이즈로 만들어줘";

/** Copy text to the clipboard, with a legacy fallback for non-secure contexts. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * 표지: build an image-generation prompt for the front/back cover from the
 * book's 내용추가 script and copy it to the clipboard. The user pastes it into
 * an image tool (with a reference photo attached).
 */
export default function CoverPromptModal({ script, onClose }: Props) {
  // Which button was just copied — shows a transient ✓ on it.
  const [copied, setCopied] = useState<"front" | "back" | null>(null);

  const story = script.trim();

  const buildPrompt = (instruction: string) =>
    story ? `${story}\n\n${instruction}` : instruction;

  const copy = async (which: "front" | "back") => {
    const text = buildPrompt(
      which === "front" ? FRONT_INSTRUCTION : BACK_INSTRUCTION,
    );
    const ok = await copyToClipboard(text);
    if (!ok) {
      alert("복사에 실패했어요. 직접 선택해 복사해 주세요.");
      return;
    }
    setCopied(which);
    window.setTimeout(() => setCopied((c) => (c === which ? null : c)), 1800);
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="bgm-head">
          <h2 className="modal-title">
            <BookImage size={18} /> 표지 프롬프트
          </h2>
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
          내용추가에 적은 <b>대본 전체</b>에 표지 지시문을 붙여 복사합니다. 복사
          후 이미지 생성 도구에 붙여넣고 참고 이미지를 첨부하세요.
          {!story && (
            <>
              {" "}
              <b style={{ color: "#e0392b" }}>
                ※ 내용추가에 입력한 대본이 없어 지시문만 복사됩니다.
              </b>
            </>
          )}
        </p>

        <div className="cover-prompt__btns">
          <button
            type="button"
            className="cover-prompt__btn"
            onClick={() => void copy("front")}
          >
            {copied === "front" ? <Check size={18} /> : <CopyIcon size={18} />}
            <span>{copied === "front" ? "앞표지 복사됨!" : "앞표지 프롬프트 복사"}</span>
          </button>
          <button
            type="button"
            className="cover-prompt__btn"
            onClick={() => void copy("back")}
          >
            {copied === "back" ? <Check size={18} /> : <CopyIcon size={18} />}
            <span>{copied === "back" ? "뒷표지 복사됨!" : "뒷표지 프롬프트 복사"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
