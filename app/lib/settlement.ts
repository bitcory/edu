import type { AuthorType } from "./author-types";

/**
 * Payout breakdown for a sale. DISPLAY/ESTIMATE ONLY — no money moves yet.
 *
 * 개인(individual): 판매가에서 수수료 20%(카드수수료 포함)와 원천징수 3.3%를 각각 차감.
 * 개인사업자(business): 원천징수 없음. 수수료 20% 차감 후, 지급액에 포함된 부가세(10%)를 분리 표시.
 *   (개인사업자 부가세 처리는 가정이며 확정 전 검토 필요.)
 */

export const COMMISSION_RATE = 0.2; // 카드수수료 포함 플랫폼 수수료
export const WITHHOLDING_RATE = 0.033; // 개인 사업소득 원천징수
export const VAT_RATE = 0.1;

export type Settlement = {
  price: number;
  commission: number;
  commissionRate: number;
  withholding: number;
  withholdingRate: number;
  vat: number; // 개인사업자: 지급액에 포함된 부가세 (표시용)
  supply: number; // 개인사업자: 공급가액
  payout: number; // 실지급 예상액
};

export function computeSettlement(
  price: number,
  type: AuthorType,
): Settlement {
  const p = Math.max(0, Math.floor(Number(price) || 0));
  const commission = Math.round(p * COMMISSION_RATE);

  if (type === "individual") {
    const withholding = Math.round(p * WITHHOLDING_RATE);
    const payout = Math.max(0, p - commission - withholding);
    return {
      price: p,
      commission,
      commissionRate: COMMISSION_RATE,
      withholding,
      withholdingRate: WITHHOLDING_RATE,
      vat: 0,
      supply: payout,
      payout,
    };
  }

  // business
  const payout = Math.max(0, p - commission);
  const supply = Math.round(payout / (1 + VAT_RATE));
  const vat = payout - supply;
  return {
    price: p,
    commission,
    commissionRate: COMMISSION_RATE,
    withholding: 0,
    withholdingRate: 0,
    vat,
    supply,
    payout,
  };
}
