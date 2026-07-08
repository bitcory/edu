"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import type { AuthorApplyInput, AuthorType } from "../lib/author-types";

function squareImageDataUrl(file: File, size = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("이미지를 읽지 못했어요."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("이미지 파일을 확인해 주세요."));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("이미지 처리에 실패했어요."));
          return;
        }
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

type Props = {
  initial?: Partial<AuthorApplyInput>;
  submitting?: boolean;
  onConfirm: (input: AuthorApplyInput) => void;
  onCancel: () => void;
};

export default function AuthorRegisterModal({
  initial,
  submitting = false,
  onConfirm,
  onCancel,
}: Props) {
  const [type, setType] = useState<AuthorType>(initial?.type ?? "individual");
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [businessName, setBusinessName] = useState(initial?.businessName ?? "");
  const [intro, setIntro] = useState(initial?.intro ?? "");
  const [avatarDataUrl, setAvatarDataUrl] = useState(initial?.avatarDataUrl ?? "");
  const [consent, setConsent] = useState(initial?.consentPII ?? false);
  const [rrn, setRrn] = useState(initial?.rrn ?? "");
  const [bizNo, setBizNo] = useState(initial?.bizNo ?? "");
  const [bankName, setBankName] = useState(initial?.bankName ?? "");
  const [bankAccount, setBankAccount] = useState(initial?.bankAccount ?? "");
  const [accountHolder, setAccountHolder] = useState(
    initial?.accountHolder ?? "",
  );
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  async function pickAvatar(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일을 선택해 주세요.");
      return;
    }
    try {
      setAvatarDataUrl(await squareImageDataUrl(file));
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const submit = () => {
    if (!displayName.trim()) {
      alert("활동명(필명)을 적어 주세요.");
      return;
    }
    if (type === "business" && !businessName.trim()) {
      alert("상호명을 적어 주세요.");
      return;
    }
    onConfirm({
      type,
      displayName: displayName.trim(),
      businessName: type === "business" ? businessName.trim() : undefined,
      intro: intro.trim() || undefined,
      avatarDataUrl: avatarDataUrl || undefined,
      consentPII: consent,
      rrn: consent ? rrn.trim() || undefined : undefined,
      bizNo: consent ? bizNo.trim() || undefined : undefined,
      bankName: consent ? bankName.trim() || undefined : undefined,
      bankAccount: consent ? bankAccount.trim() || undefined : undefined,
      accountHolder: consent ? accountHolder.trim() || undefined : undefined,
    });
  };

  return (
    <div className="modal-overlay modal-overlay--author" role="dialog" aria-modal="true">
      <div className="modal-card modal-card--author">
        <div className="author-modal__head">
          <div>
            <h2 className="modal-title">
              {initial?.displayName ? "작가 정보 수정" : "작가 등록 신청"}
            </h2>
            <p className="modal-sub">
              관리자 승인 후 책을 올릴 수 있어요. 정산 정보는 필요한 시점에만
              입력합니다.
            </p>
          </div>
        </div>

        <div className="author-modal__grid">
          <div className="author-modal__side">
            <div className="modal-field">
              <span className="modal-label">유형</span>
              <div className="seg">
                <button
                  type="button"
                  className={`seg__btn${type === "individual" ? " is-active" : ""}`}
                  onClick={() => setType("individual")}
                >
                  개인
                </button>
                <button
                  type="button"
                  className={`seg__btn${type === "business" ? " is-active" : ""}`}
                  onClick={() => setType("business")}
                >
                  개인사업자
                </button>
              </div>
            </div>

            <div className="modal-field author-modal__avatar-field">
              <span className="modal-label">작가 이미지 (1:1)</span>
              <div className="author-avatar-edit">
                <button
                  type="button"
                  className="author-avatar-edit__preview"
                  onClick={() => avatarInputRef.current?.click()}
                  title="작가 이미지 선택"
                >
                  {avatarDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarDataUrl} alt="작가 이미지 미리보기" />
                  ) : (
                    <span>
                      <ImagePlus size={22} />
                      이미지 선택
                    </span>
                  )}
                </button>
                <div className="author-avatar-edit__actions">
                  <button
                    type="button"
                    className="store-navlink"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    이미지 업로드
                  </button>
                  {avatarDataUrl && (
                    <button
                      type="button"
                      className="store-navlink"
                      onClick={() => setAvatarDataUrl("")}
                    >
                      제거
                    </button>
                  )}
                  <span>중앙 기준 정사각형으로 저장됩니다.</span>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    void pickAvatar(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          </div>

          <div className="author-modal__main">
            <div className="author-modal__fields">
              <label className="modal-field">
                <span className="modal-label">활동명 (필명)</span>
                <input
                  className="modal-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={40}
                />
              </label>

              {type === "business" && (
                <label className="modal-field">
                  <span className="modal-label">상호명</span>
                  <input
                    className="modal-input"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    maxLength={60}
                  />
                </label>
              )}
            </div>

            <label className="modal-field">
              <span className="modal-label">소개 (선택)</span>
              <textarea
                className="modal-input modal-textarea author-modal__intro"
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                rows={3}
                maxLength={300}
              />
            </label>

            <div className="consent-box">
              <label className="consent-check">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  정산을 위한 <strong>개인정보 수집·제공에 동의</strong>합니다
                  (주민번호·계좌·사업자번호).
                </span>
              </label>

              {consent && (
                <fieldset className="payout-fields">
                  {type === "individual" && (
                    <label className="modal-field">
                      <span className="modal-label">주민등록번호</span>
                      <input
                        className="modal-input"
                        value={rrn}
                        onChange={(e) => setRrn(e.target.value)}
                        placeholder="000000-0000000"
                        inputMode="numeric"
                      />
                    </label>
                  )}
                  {type === "business" && (
                    <label className="modal-field">
                      <span className="modal-label">사업자등록번호</span>
                      <input
                        className="modal-input"
                        value={bizNo}
                        onChange={(e) => setBizNo(e.target.value)}
                        placeholder="000-00-00000"
                        inputMode="numeric"
                      />
                    </label>
                  )}
                  <label className="modal-field">
                    <span className="modal-label">은행명</span>
                    <input
                      className="modal-input"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="예: 국민은행"
                    />
                  </label>
                  <label className="modal-field">
                    <span className="modal-label">계좌번호</span>
                    <input
                      className="modal-input"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      inputMode="numeric"
                    />
                  </label>
                  <label className="modal-field">
                    <span className="modal-label">예금주</span>
                    <input
                      className="modal-input"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                    />
                  </label>
                </fieldset>
              )}
            </div>
          </div>
        </div>

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
            {submitting ? "신청 중…" : "신청하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
