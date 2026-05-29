/** 0 → "무료", otherwise "3,000원". */
export function formatPrice(price: number): string {
  if (!price || price <= 0) return "무료";
  return `${price.toLocaleString("ko-KR")}원`;
}
