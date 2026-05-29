"use client";

import { useEffect, useState } from "react";
import { Pipette, X } from "lucide-react";

/** Curated palette — greyscale row + colorful rows (pastel → saturated → deep). */
const PALETTE: string[] = [
  "#000000", "#4d4d4d", "#808080", "#999999", "#b3b3b3", "#d9d9d9", "#f2f2f2", "#ffffff",
  "#f9c8c8", "#fde2b8", "#fff4b8", "#d7efc4", "#c6ecec", "#cfe3fb", "#dcd2f5", "#f3cfe8",
  "#f4948f", "#fbc56a", "#ffe06b", "#a9dd8e", "#8fd6d6", "#9cc4f5", "#bda7ec", "#e79ad0",
  "#f0593f", "#f59a2e", "#ffcf33", "#5fb95f", "#3bb6b6", "#4a90e2", "#8b6fd6", "#d05ab0",
  "#c8351f", "#d97a12", "#e0a800", "#2f8f3a", "#1f8f8f", "#2f6fc4", "#5f3fb0", "#a8328f",
  "#7a1f12", "#8a4a0a", "#8a6a00", "#1f5a26", "#125a5a", "#1d4a8f", "#3a247a", "#6a1f5a",
];

function toHex(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
}

type Props = {
  value: string;
  onChange: (color: string) => void;
  /** Optional class for the trigger swatch (e.g. ed-swatch / ed-input). */
  className?: string;
};

export default function ColorField({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);

  useEffect(() => setHex(value), [value]);

  const hasEyedropper =
    typeof window !== "undefined" && "EyeDropper" in window;

  const pickEyedropper = async () => {
    try {
      // @ts-expect-error EyeDropper is not yet in TS lib DOM types
      const result = await new window.EyeDropper().open();
      if (result?.sRGBHex) onChange(result.sRGBHex);
    } catch {
      /* user cancelled */
    }
  };

  const commitHex = (raw: string) => {
    setHex(raw);
    const v = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
  };

  return (
    <>
      <button
        type="button"
        className={`cp-trigger ${className ?? ""}`}
        style={{ background: toHex(value) }}
        onClick={() => setOpen(true)}
        aria-label="색상 선택"
        title="색상 선택"
      />
      {open && (
        <div
          className="cp-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div className="cp-card" onClick={(e) => e.stopPropagation()}>
            <div className="cp-head">
              <h3>색상</h3>
              <button
                type="button"
                className="cp-close"
                onClick={() => setOpen(false)}
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div className="cp-section-label">기본 팔레트</div>
            <div className="cp-grid">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`cp-cell${
                    c.toLowerCase() === value.toLowerCase() ? " is-sel" : ""
                  }`}
                  style={{ background: c }}
                  onClick={() => onChange(c)}
                  aria-label={c}
                />
              ))}
            </div>

            <div className="cp-foot">
              <span className="cp-current" style={{ background: toHex(value) }} />
              <input
                className="cp-hex"
                value={hex}
                onChange={(e) => commitHex(e.target.value)}
                spellCheck={false}
              />
              <label className="cp-pick" title="직접 선택">
                <input
                  type="color"
                  value={toHex(value)}
                  onChange={(e) => onChange(e.target.value)}
                />
              </label>
              {hasEyedropper && (
                <button
                  type="button"
                  className="cp-eyedrop"
                  onClick={() => void pickEyedropper()}
                  title="화면에서 색 추출"
                  aria-label="스포이드"
                >
                  <Pipette size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
