"use client";

import Link from "next/link";
import { BookPlus, Home } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import BookViewer from "../components/BookViewer";
import {
  renderPdfToImages,
  revokePages,
  type RenderedPage,
} from "../lib/pdf-to-images";
import { registerPdfBook } from "../lib/store";

type LoadState =
  | { kind: "idle" }
  | { kind: "loading"; current: number; total: number; name: string }
  | { kind: "ready"; pages: RenderedPage[]; name: string; file: File }
  | { kind: "error"; message: string };

async function makeThumb(url: string, maxW = 300): Promise<string | undefined> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, maxW / img.naturalWidth);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return undefined;
    ctx.drawImage(img, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.7);
  } catch {
    return undefined;
  }
}

export default function ViewPage() {
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
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
      setRegistered(false);
      setState({ kind: "ready", pages, name: file.name, file });
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

  const register = useCallback(async () => {
    if (state.kind !== "ready") return;
    const defaultTitle = state.name.replace(/\.pdf$/i, "");
    const title = window.prompt("내 서재에 등록할 책 제목", defaultTitle);
    if (title === null) return;
    setRegistering(true);
    try {
      const cover = state.pages[0]
        ? await makeThumb(state.pages[0].url)
        : undefined;
      await registerPdfBook(state.file, title, cover);
      setRegistered(true);
      alert("내 서재에 등록했어요!");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRegistering(false);
    }
  }, [state]);

  if (state.kind === "ready") {
    return (
      <>
        <BookViewer pages={state.pages} onClose={reset} />
        <button
          type="button"
          className="bv-register"
          onClick={() => void register()}
          disabled={registering || registered}
        >
          <BookPlus size={16} />
          {registered
            ? "등록됨"
            : registering
              ? "등록 중…"
              : "내 서재에 등록"}
        </button>
      </>
    );
  }

  return (
    <main className="upload-shell">
      <div className="upload-card">
        <div className="upload-cover-band" aria-hidden />
        <Link
          href="/"
          className="home-btn"
          aria-label="처음으로"
          title="처음으로"
        >
          <Home size={20} strokeWidth={2} />
        </Link>
        <h1 className="upload-title">MAGIC BOOK</h1>
        <p className="upload-sub">
          PDF를 올리면 그림책처럼 한 장씩 넘겨 볼 수 있어요.
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
