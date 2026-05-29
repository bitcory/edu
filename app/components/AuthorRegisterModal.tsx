"use client";

import { useState } from "react";
import type { AuthorApplyInput, AuthorType } from "../lib/author-types";

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
  const [consent, setConsent] = useState(initial?.consentPII ?? false);
  const [rrn, setRrn] = useState(initial?.rrn ?? "");
  const [bizNo, setBizNo] = useState(initial?.bizNo ?? "");
  const [bankName, setBankName] = useState(initial?.bankName ?? "");
  const [bankAccount, setBankAccount] = useState(initial?.bankAccount ?? "");
  const [accountHolder, setAccountHolder] = useState(
    initial?.accountHolder ?? "",
  );

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
      consentPII: consent,
      rrn: consent ? rrn.trim() || undefined : undefined,
      bizNo: consent ? bizNo.trim() || undefined : undefined,
      bankName: consent ? bankName.trim() || undefined : undefined,
      bankAccount: consent ? bankAccount.trim() || undefined : undefined,
      accountHolder: consent ? accountHolder.trim() || undefined : undefined,
    });
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h2 className="modal-title">작가 등록 신청</h2>
        <p className="modal-sub">
          관리자 승인 후 책을 올릴 수 있어요. 민감정보(주민번호·계좌·사업자등록증)는
          나중에 정산 단계에서 안전하게 받습니다.
        </p>

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

        <label className="modal-field">
          <span className="modal-label">소개 (선택)</span>
          <textarea
            className="modal-input modal-textarea"
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

          <fieldset className="payout-fields" disabled={!consent}>
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
