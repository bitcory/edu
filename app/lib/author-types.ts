// Neutral (no "use client") so client and server can both import.

export type AuthorType = "individual" | "business";
export type AuthorStatus = "pending" | "approved" | "rejected";

// Sensitive payout fields (개인정보). Collected only after PII consent.
// PROTOTYPE: stored as plaintext — MUST be encrypted (or moved to a vault)
// before production. 주민번호 평문 저장은 법적으로 위험.
export type AuthorPayoutInfo = {
  consentPII: boolean; // 개인정보 수집·제공 동의
  rrn?: string; // 주민등록번호 (개인)
  bizNo?: string; // 사업자등록번호 (개인사업자) 000-00-00000
  bankName?: string; // 은행명
  bankAccount?: string; // 계좌번호
  accountHolder?: string; // 예금주
};

export type Author = {
  userId: string;
  email: string | null;
  displayName: string;
  type: AuthorType;
  businessName?: string; // 개인사업자 상호
  intro?: string;
  status: AuthorStatus;
  appliedAt: number;
  reviewedAt?: number;
  rejectReason?: string;
} & AuthorPayoutInfo;

export type AuthorApplyInput = {
  displayName: string;
  type: AuthorType;
  businessName?: string;
  intro?: string;
} & Partial<AuthorPayoutInfo>;
