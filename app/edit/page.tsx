"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import BookViewer from "../components/BookViewer";
import SubmitBookModal, {
  type SubmitValues,
} from "../components/SubmitBookModal";
import { renderSnapshotToImages } from "../lib/render-book";
import { revokePages, type RenderedPage } from "../lib/pdf-to-images";
import type { EditorPage } from "../lib/editor-types";
import { loadEditorState } from "../lib/editor-storage";
import { getBook, submitBook, updateBook } from "../lib/store";
import type { BookLayout } from "../lib/book-types";
import { DEFAULT_TEMPLATE } from "../lib/templates";
import { fetchMyAuthor } from "../lib/author-store";
import type { Author } from "../lib/author-types";

// Editor uses Fabric.js → must be client-only.
const Editor = dynamic(() => import("../components/editor/Editor"), {
  ssr: false,
});

type Mode =
  | { kind: "edit" }
  | { kind: "exporting" }
  | {
      kind: "preview";
      pages: EditorPage[];
      rendered: RenderedPage[];
      pdfUrl: string;
      pdfBytes: Uint8Array;
    };

function EditPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookId = searchParams.get("book");

  const [initialPages, setInitialPages] = useState<EditorPage[] | null>(null);
  const [loadingBook, setLoadingBook] = useState<boolean>(!!bookId);
  const [mode, setMode] = useState<Mode>({ kind: "edit" });
  const [submitting, setSubmitting] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [author, setAuthor] = useState<Author | null>(null);
  const [pageW, setPageW] = useState<number>(DEFAULT_TEMPLATE.width);
  const [prevPageW, setPrevPageW] = useState<number>(DEFAULT_TEMPLATE.width);
  const [layout, setLayout] = useState<BookLayout>(DEFAULT_TEMPLATE.layout);

  useEffect(() => {
    fetchMyAuthor().then(setAuthor);
  }, []);

  const onTemplateChange = useCallback(
    (w: number, l: BookLayout) => {
      setPrevPageW(pageW); // remember the old width so centered content recenters
      setPageW(w);
      setLayout(l);
    },
    [pageW],
  );

  const openStoreSubmit = useCallback(() => {
    if (author?.status !== "approved") {
      alert("작가 승인을 받아야 책을 올릴 수 있어요. 내 서재에서 작가 등록을 해주세요.");
      router.push("/library");
      return;
    }
    setSubmitOpen(true);
  }, [author, router]);

  // Load an existing library book into the editor when ?book=<id> is present.
  useEffect(() => {
    let cancelled = false;
    if (!bookId) {
      setInitialPages(null);
      // New book: adopt 판형 from the working draft if present.
      const saved = loadEditorState();
      const w = saved?.pageW ?? DEFAULT_TEMPLATE.width;
      setPageW(w);
      setPrevPageW(w); // equal → no recenter on load
      if (saved?.layout) setLayout(saved.layout);
      setLoadingBook(false);
      return;
    }
    setLoadingBook(true);
    getBook(bookId).then((b) => {
      if (cancelled) return;
      if (b) {
        setInitialPages(b.pages);
        const w = b.pageW || DEFAULT_TEMPLATE.width;
        setPageW(w);
        setPrevPageW(w); // equal → no recenter on load
        setLayout(b.layout || DEFAULT_TEMPLATE.layout);
      }
      setLoadingBook(false);
    });
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    return () => {
      if (mode.kind === "preview") {
        revokePages(mode.rendered);
        URL.revokeObjectURL(mode.pdfUrl);
      }
    };
  }, [mode]);

  const handleFinish = useCallback(
    async (pages: EditorPage[], pw: number, lyt: BookLayout) => {
      setPageW(pw);
      setLayout(lyt);
      setMode({ kind: "exporting" });
      try {
        const { rendered, pdfUrl, pdfBytes } = await renderSnapshotToImages(
          pages,
          "내가만든책.pdf",
          pw,
        );
        setMode({ kind: "preview", pages, rendered, pdfUrl, pdfBytes });
      } catch (err) {
      console.error(err);
      alert("PDF로 만드는 중 문제가 생겼어요: " + (err as Error).message);
      setMode({ kind: "edit" });
    }
  }, []);

  const handleSubmitToStore = useCallback(
    async (pages: EditorPage[], values: SubmitValues) => {
      setSubmitting(true);
      try {
        if (bookId) {
          await updateBook(bookId, {
            pages,
            title: values.title,
            description: values.description,
            price: values.price,
            pageW,
            layout,
          });
        } else {
          await submitBook({
            title: values.title,
            author: values.author,
            description: values.description,
            price: values.price,
            pageW,
            layout,
            pages,
          });
        }
        alert("북스토어에 올렸어요! 슈퍼관리자 승인 후 모두에게 공개돼요.");
        router.push("/library");
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setSubmitting(false);
        setSubmitOpen(false);
      }
    },
    [bookId, router, pageW, layout],
  );

  if (loadingBook) {
    return <div className="ed-overlay">책을 불러오는 중…</div>;
  }

  const isPreview = mode.kind === "preview";
  return (
    <>
      <div style={{ display: isPreview ? "none" : "contents" }}>
        <Editor
          key={`${bookId ?? "new"}-${pageW}`}
          onFinish={handleFinish}
          exporting={mode.kind === "exporting"}
          initialPages={initialPages ?? undefined}
          pageW={pageW}
          prevPageW={prevPageW}
          layout={layout}
          onTemplateChange={onTemplateChange}
        />
      </div>
      {mode.kind === "exporting" && (
        <div className="ed-overlay">책으로 만드는 중…</div>
      )}
      {isPreview && (
        <>
          <BookViewer
            pages={mode.rendered}
            singlePage={layout === "single"}
            onClose={() => setMode({ kind: "edit" })}
          />
          <div className="ed-preview-actions">
            <a
              href={mode.pdfUrl}
              download="내가만든책.pdf"
              className="ed-action ed-action--download"
            >
              <Download size={16} /> PDF 받기
            </a>
            <button
              type="button"
              className="ed-action ed-action--store"
              disabled={submitting}
              onClick={openStoreSubmit}
            >
              {submitting ? (
                <Loader2 size={16} className="ed-spin" />
              ) : (
                <Upload size={16} />
              )}
              {bookId ? "북스토어에 다시 올리기" : "북스토어에 올리기"}
            </button>
          </div>
          {submitOpen && (
            <SubmitBookModal
              submitting={submitting}
              authorType={author?.type}
              onCancel={() => setSubmitOpen(false)}
              onConfirm={(values) => void handleSubmitToStore(mode.pages, values)}
            />
          )}
        </>
      )}
    </>
  );
}

export default function EditPage() {
  return (
    <Suspense fallback={<div className="ed-overlay">불러오는 중…</div>}>
      <EditPageInner />
    </Suspense>
  );
}
