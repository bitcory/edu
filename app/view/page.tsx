"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import BookViewer from "../components/BookViewer";
import {
  renderPdfToImages,
  revokePages,
  type RenderedPage,
} from "../lib/pdf-to-images";

type LoadState =
  | { kind: "idle" }
  | { kind: "loading"; current: number; total: number; name: string }
  | { kind: "ready"; pages: RenderedPage[]; name: string }
  | { kind: "error"; message: string };

export default function ViewPage() {
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (state.kind === "ready") revokePages(state.pages);
    };
  }, [state]);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setState({ kind: "error", message: "PDF 파일만 열 수 있어요." });
      return;
    }
    setState({ kind: "loading", current: 0, total: 0, name: file.name });
    try {
      const pages = await renderPdfToImages(file, (current, total) => {
        setState({ kind: "loading", current, total, name: file.name });
      });
      setState({ kind: "ready", pages, name: file.name });
    } catch (err) {
      console.error(err);
      setState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "PDF를 여는 중 문제가 생겼어요.",
      });
    }
  }, []);

  const reset = useCallback(() => {
    if (inputRef.current) inputRef.current.value = "";
    setState({ kind: "idle" });
  }, []);

  if (state.kind === "ready") {
    return <BookViewer pages={state.pages} onClose={reset} />;
  }

  return (
    <main className="upload-shell">
      <div className="upload-card">
        <div className="upload-cover-band" aria-hidden />
        <Link href="/" className="upload-home" aria-label="처음으로">
          <ArrowLeft size={14} /> 처음으로
        </Link>
        <h1 className="upload-title">Magic Book</h1>
        <p className="upload-sub">
          PDF 파일을 골라 주면 진짜 책처럼 펼쳐서 볼 수 있어요.
        </p>

        <label
          htmlFor="pdf-input"
          className="upload-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add("is-dragover");
          }}
          onDragLeave={(e) =>
            e.currentTarget.classList.remove("is-dragover")
          }
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("is-dragover");
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
        >
          <span className="upload-book-mark" aria-hidden>
            PDF
          </span>
          <span className="upload-cta">PDF 고르기</span>
          <span className="upload-hint">또는 여기로 끌어다 놓기</span>
          <input
            ref={inputRef}
            id="pdf-input"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </label>

        {state.kind === "loading" && (
          <div className="upload-status" role="status">
            <div className="spinner" aria-hidden />
            <div>
              <strong>{state.name}</strong>
              <div className="muted">
                {state.total > 0
                  ? `책을 펼치는 중… ${state.current} / ${state.total}쪽`
                  : "책을 펼치는 중…"}
              </div>
            </div>
          </div>
        )}

        {state.kind === "error" && (
          <div className="upload-error" role="alert">
            {state.message}
            <button type="button" onClick={reset} className="upload-retry">
              다시 시도
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
