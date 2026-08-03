/**
 * 이미지 생성 모델 선택지.
 *
 * 목록은 이 계정의 실제 models 응답에서 확인하고, 각 모델로 실제 생성 요청을
 * 한 번씩 보내 호출되는 것만 남겼다 — models 목록에 있다고 쓸 수 있는 게
 * 아니기 때문이다(gemini-2.5-pro 는 목록에 있으면서도 "no longer available to
 * new users" 로 거부됐다).
 *
 * 기본값은 flash 계열이다. 컷 하나에 한 번씩, 책 한 권이면 수십 번 호출되므로
 * 속도와 비용이 결과 품질만큼 중요하다. 공들인 표지나 캐릭터 시트처럼 몇 장만
 * 뽑을 때 pro 로 올리면 된다.
 */

export type ImageModel = {
  id: string;
  label: string;
  desc: string;
};

export const IMAGE_MODELS: ImageModel[] = [
  {
    id: "gemini-2.5-flash-image",
    label: "2.5 Flash",
    desc: "빠르고 저렴 — 컷을 많이 뽑을 때",
  },
  {
    id: "gemini-3.1-flash-image",
    label: "3.1 Flash",
    desc: "flash 계열 최신",
  },
  {
    id: "gemini-3-pro-image",
    label: "3.0 Pro",
    desc: "느리고 비싸지만 묘사가 정교함 — 표지·캐릭터 시트에",
  },
];

export const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";

/** 저장된 값이 목록에서 사라졌을 때 기본값으로 되돌린다. */
export function normalizeImageModel(id: string | null | undefined): string {
  return IMAGE_MODELS.some((m) => m.id === id) ? (id as string) : DEFAULT_IMAGE_MODEL;
}
