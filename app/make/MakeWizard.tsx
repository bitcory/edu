"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Home, Wand2 } from "lucide-react";
import {
  ACTIONS,
  CHARACTERS,
  LOCATIONS,
  actionImageUrl,
  characterImageUrl,
  locationImageUrl,
  type ActionId,
  type CharacterId,
  type LocationId,
} from "../lib/make-catalog";

/**
 * 객관식 4단계: 주인공 → 행동 → 장소 → 이름.
 *
 * 이용자가 영유아라 한 화면에 질문 하나만 두고, 터치 타깃을 크게 잡는다.
 * 고른 즉시 다음 단계로 넘어가서 "확인" 같은 중간 단계를 없앴다.
 */

type Step = 0 | 1 | 2 | 3;

const STEP_TITLES = [
  "누가 나올까요?",
  "무엇을 할까요?",
  "어디에서 할까요?",
  "이름이 뭐예요?",
];

export default function MakeWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [character, setCharacter] = useState<CharacterId | null>(null);
  const [action, setAction] = useState<ActionId | null>(null);
  const [location, setLocation] = useState<LocationId | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function back() {
    setError(null);
    if (step === 0) router.push("/");
    else setStep((step - 1) as Step);
  }

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/make", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ character, action, location, name: name.trim() }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setError(data?.error ?? "그림책을 만들지 못했어요. 다시 해 볼까요?");
      setBusy(false);
      return;
    }
    // 책은 서재에서 펼쳐 본다.
    router.push("/library");
  }

  return (
    <main className={`make-shell make-shell--step-${step}`}>
      <div className="make-topbar">
        <button type="button" className="make-back" onClick={back} disabled={busy}>
          <ArrowLeft size={20} /> 뒤로
        </button>
        <div className="make-dots" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`make-dot${i === step ? " is-current" : ""}${i < step ? " is-done" : ""}`}
            />
          ))}
        </div>
        <Link href="/" className="make-back">
          <Home size={20} /> 처음
        </Link>
      </div>

      <h1 className="make-question">{STEP_TITLES[step]}</h1>

      {step === 0 && (
        <div className="make-grid make-grid--7">
          {CHARACTERS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`make-pick${character === c.id ? " is-picked" : ""}`}
              onClick={() => {
                setCharacter(c.id);
                setStep(1);
              }}
            >
              <Image
                className="make-pick__img"
                src={characterImageUrl(c.id)}
                alt=""
                width={400}
                height={500}
                unoptimized
              />
              <span className="make-pick__label">{c.label}</span>
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="make-grid make-grid--3">
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`make-pick${action === a.id ? " is-picked" : ""}`}
              onClick={() => {
                setAction(a.id);
                setStep(2);
              }}
            >
              <Image
                className="make-pick__img"
                src={actionImageUrl(a.id)}
                alt=""
                width={400}
                height={500}
                unoptimized
              />
              <span className="make-pick__label">{a.label}</span>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="make-grid make-grid--3">
          {LOCATIONS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`make-pick${location === l.id ? " is-picked" : ""}`}
              onClick={() => {
                setLocation(l.id);
                setStep(3);
              }}
            >
              <Image
                className="make-pick__img"
                src={locationImageUrl(l.id)}
                alt=""
                width={400}
                height={500}
                unoptimized
              />
              <span className="make-pick__label">{l.label}</span>
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <form
          className="make-name"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && name.trim()) void create();
          }}
        >
          <Image
            className="make-name__art"
            src="/make-name-book.png"
            alt="별빛이 펼쳐지는 마법 그림책"
            width={1122}
            height={1402}
            priority
          />
          <input
            className="make-name__input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            maxLength={10}
            autoComplete="off"
            autoFocus
            disabled={busy}
          />
          <p className="make-name__hint">
            그림책 속 주인공 이름이 돼요. 한글 또는 영문 1~10자.
          </p>
          {error && (
            <p className="make-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="make-create"
            disabled={busy || !name.trim()}
          >
            <Wand2 size={26} />
            {busy ? "만드는 중…" : "그림책 만들기"}
          </button>
        </form>
      )}
    </main>
  );
}
