"use client";

import { useCallback, useEffect, useState } from "react";
import { IMAGE_MODELS, DEFAULT_IMAGE_MODEL } from "../lib/image-models";

/**
 * 이미지 생성 모델 선택.
 *
 * 기본은 flash 계열이다 — 컷 하나에 한 번씩, 책 한 권이면 수십 번 호출되므로
 * 속도·비용이 품질만큼 중요하다. 표지처럼 몇 장만 공들일 때 pro 로 올린다.
 */
export default function ImageModelPicker() {
  const [model, setModel] = useState<string>(DEFAULT_IMAGE_MODEL);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/settings/prefs", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      if (d?.imageModel) setModel(d.imageModel);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function pick(id: string) {
    setModel(id); // 먼저 반영해 두면 클릭이 즉시 반응한다.
    setBusy(true);
    const r = await fetch("/api/settings/prefs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageModel: id }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    // 서버가 정규화한 값이 최종이다 (목록에서 사라진 모델이면 되돌아온다).
    if (d?.imageModel) setModel(d.imageModel);
    setBusy(false);
  }

  if (!loaded) return <p className="admin-empty">불러오는 중…</p>;

  return (
    <section className="cred-card">
      <div className="cred-card__head">
        <h3>이미지 생성 모델</h3>
      </div>
      <p className="cred-hint">
        그림을 만들 때 쓸 모델입니다. 컷마다 한 번씩 호출되니, 컷이 많으면 빠른
        쪽이 유리합니다.
      </p>
      <div className="design-choices">
        {IMAGE_MODELS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`design-choice${model === m.id ? " is-active" : ""}`}
            aria-pressed={model === m.id}
            disabled={busy}
            onClick={() => void pick(m.id)}
          >
            <span className="design-choice__title">{m.label}</span>
            <span className="design-choice__desc">{m.desc}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
