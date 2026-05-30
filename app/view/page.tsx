"use client";

import Link from "next/link";
import { BookPlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import BookViewer from "../components/BookViewer";
import {
  renderPdfToImages,
  revokePages,
  type RenderedPage,
} from "../lib/pdf-to-images";
import { registerPdfBook } from "../lib/store";
import SubmitBookModal, {
  type SubmitValues,
} from "../components/SubmitBookModal";
import { urlToThumb } from "../lib/thumbnail";
import { OPEN_PUBLISH } from "../lib/publish-policy";

type LoadState =
  | { kind: "idle" }
  | { kind: "loading"; current: number; total: number; name: string }
  | { kind: "ready"; pages: RenderedPage[]; name: string; file: File }
  | { kind: "error"; message: string };

export default function ViewPage() {
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  // Holds the auto-generated cover while the submit modal is open.
  const [submit, setSubmit] = useState<{ cover?: string; title: string } | null>(
    null,
  );
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

  // Open the submit modal — auto-fill the cover from the first PDF page.
  const openSubmit = useCallback(async () => {
    if (state.kind !== "ready") return;
    const defaultTitle = state.name.replace(/\.pdf$/i, "");
    const cover = state.pages[0]
      ? await urlToThumb(state.pages[0].url)
      : undefined;
    setSubmit({ cover, title: defaultTitle });
  }, [state]);

  const confirmSubmit = useCallback(
    async (values: SubmitValues) => {
      if (state.kind !== "ready") return;
      setRegistering(true);
      try {
        await registerPdfBook(state.file, {
          title: values.title,
          author: values.author,
          description: values.description,
          category: values.category,
          price: values.price,
          coverThumb: values.cover,
        });
        setRegistered(true);
        setSubmit(null);
        alert(
          OPEN_PUBLISH
            ? "스토어에 올렸어요! 이제 모두가 볼 수 있어요."
            : "내 서재에 등록했어요!",
        );
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setRegistering(false);
      }
    },
    [state],
  );

  if (state.kind === "ready") {
    return (
      <>
        <BookViewer pages={state.pages} onClose={reset} />
        <button
          type="button"
          className="bv-register"
          onClick={() => void openSubmit()}
          disabled={registering || registered}
        >
          <BookPlus size={16} />
          {registered
            ? "등록됨"
            : registering
              ? "등록 중…"
              : OPEN_PUBLISH
                ? "스토어에 올리기"
                : "내 서재에 등록"}
        </button>
        {submit && (
          <SubmitBookModal
            submitting={registering}
            initial={{ title: submit.title, cover: submit.cover }}
            onCancel={() => setSubmit(null)}
            onConfirm={(values) => void confirmSubmit(values)}
          />
        )}
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
        />
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
