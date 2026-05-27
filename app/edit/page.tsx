"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import BookViewer from "../components/BookViewer";
import {
  pagesPngToPdf,
  pdfBytesToBlobUrl,
  pdfBytesToFile,
} from "../lib/book-to-pdf";
import {
  renderPdfToImages,
  revokePages,
  type RenderedPage,
} from "../lib/pdf-to-images";
import type { EditorPage } from "../lib/editor-types";

// Editor uses Fabric.js → must be client-only.
const Editor = dynamic(() => import("../components/editor/Editor"), {
  ssr: false,
});

type Mode =
  | { kind: "edit" }
  | { kind: "exporting" }
  | {
      kind: "preview";
      pages: RenderedPage[];
      pdfUrl: string;
      pdfBytes: Uint8Array;
    };

export default function EditPage() {
  const [mode, setMode] = useState<Mode>({ kind: "edit" });

  useEffect(() => {
    return () => {
      if (mode.kind === "preview") {
        revokePages(mode.pages);
        URL.revokeObjectURL(mode.pdfUrl);
      }
    };
  }, [mode]);

  const handleFinish = useCallback(async (pages: EditorPage[]) => {
    setMode({ kind: "exporting" });
    try {
      // Render each page's serialized state to PNG via an offscreen Fabric canvas.
      const fabric = await import("fabric");
      const { PAGE_H, PAGE_W } = await import("../lib/editor-types");
      const offEl = document.createElement("canvas");
      offEl.width = PAGE_W;
      offEl.height = PAGE_H;
      const off = new fabric.StaticCanvas(offEl, {
        width: PAGE_W,
        height: PAGE_H,
        backgroundColor: "#ffffff",
      });
      const pngs: string[] = [];
      for (const page of pages) {
        if (page.data) {
          await off.loadFromJSON(page.data);
          off.renderAll();
        } else {
          off.clear();
          off.backgroundColor = "#ffffff";
          off.renderAll();
        }
        pngs.push(
          off.toDataURL({ format: "png", multiplier: 1 }),
        );
      }
      off.dispose();

      const pdfBytes = await pagesPngToPdf(pngs);
      const pdfUrl = pdfBytesToBlobUrl(pdfBytes);

      // Re-render the PDF to images for the BookViewer (cleaner than re-using
      // the PNGs directly because the viewer already understands the PDF path).
      const file = await pdfBytesToFile(pdfBytes, "내가만든책.pdf");
      const renderedPages = await renderPdfToImages(file);

      setMode({ kind: "preview", pages: renderedPages, pdfUrl, pdfBytes });
    } catch (err) {
      console.error(err);
      alert("PDF로 만드는 중 문제가 생겼어요: " + (err as Error).message);
      setMode({ kind: "edit" });
    }
  }, []);

  // Keep the Editor mounted across mode changes so going from
  // 책으로 만들기 → 책 미리보기 → 다른 책 (back to editor) does not lose
  // any in-progress canvas state. We just hide it visually when previewing.
  const isPreview = mode.kind === "preview";
  return (
    <>
      <div style={{ display: isPreview ? "none" : "contents" }}>
        <Editor
          onFinish={handleFinish}
          exporting={mode.kind === "exporting"}
        />
      </div>
      {mode.kind === "exporting" && (
        <div className="ed-overlay">책으로 만드는 중…</div>
      )}
      {isPreview && (
        <>
          <BookViewer
            pages={mode.pages}
            onClose={() => setMode({ kind: "edit" })}
          />
          <a
            href={mode.pdfUrl}
            download="내가만든책.pdf"
            className="ed-download"
          >
            ⬇ PDF 받기
          </a>
        </>
      )}
    </>
  );
}
