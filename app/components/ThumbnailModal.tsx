"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { FabricObject } from "fabric";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  BringToFront,
  Circle as CircleIcon,
  Download,
  Image as ImageIcon,
  SendToBack,
  Square as SquareIcon,
  Trash2,
  Type as TypeIcon,
  X,
} from "lucide-react";
import FabricCanvas, {
  type FabricApi,
  type Guide,
} from "./editor/FabricCanvas";
import type { EditorPage } from "../lib/editor-types";
import { PAGE_H } from "../lib/editor-types";
import { renderCoverThumb } from "../lib/render-book";
import { DEFAULT_FONT, ensureFont, groupFonts } from "../lib/fonts";

type Props = {
  /** Page 0 of the book — its rendered image seeds the thumbnail. */
  coverPage: EditorPage | undefined;
  /** Book 판형 width (height is PAGE_H), for the "판형" ratio preset. */
  pageW: number;
  onClose: () => void;
};

type Ratio = { key: string; label: string; w: number; h: number };

// Longest side of the editing canvas in fabric-pixel space. The exported PNG is
// this × the download multiplier, so 1000 → 2000px on the long edge at 2×.
const BASE = 1000;

function canvasDims(r: Ratio): { w: number; h: number } {
  const max = Math.max(r.w, r.h);
  return {
    w: Math.round((BASE * r.w) / max),
    h: Math.round((BASE * r.h) / max),
  };
}

// <input type="color"> only accepts #rrggbb. Fabric often hands back
// "rgb(0,0,0)" etc. — normalize so the picker doesn't spam console warnings.
function toHexColor(c: string | undefined | null, fallback = "#000000"): string {
  if (!c) return fallback;
  if (c.startsWith("#")) {
    if (c.length === 4) {
      return (
        "#" +
        c
          .slice(1)
          .split("")
          .map((ch) => ch + ch)
          .join("")
      );
    }
    return c.slice(0, 7);
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(",").map((x) => Math.round(parseFloat(x)));
    const h = (n: number) =>
      Math.max(0, Math.min(255, n || 0))
        .toString(16)
        .padStart(2, "0");
    return `#${h(parts[0])}${h(parts[1])}${h(parts[2])}`;
  }
  return fallback;
}

// Cover-fit an image object to a w×h canvas (fill + center), so it always looks
// right after a ratio switch instead of keeping its old scale/position.
function fitCover(obj: FabricObject, w: number, h: number) {
  const iw = (obj as unknown as { width?: number }).width ?? 1;
  const ih = (obj as unknown as { height?: number }).height ?? 1;
  // Overscan + a couple of bleed pixels so float/display rounding never leaves
  // a white sliver at the right/bottom edge. Positions floored to whole pixels.
  const s = Math.max((w + 2) / iw, (h + 2) / ih) * 1.01;
  obj.set({
    scaleX: s,
    scaleY: s,
    left: Math.floor((w - iw * s) / 2),
    top: Math.floor((h - ih * s) / 2),
    originX: "left",
    originY: "top",
  });
}

export default function ThumbnailModal({ coverPage, pageW, onClose }: Props) {
  const RATIOS: Ratio[] = [
    { key: "16:9", label: "16:9", w: 16, h: 9 },
    { key: "9:16", label: "9:16", w: 9, h: 16 },
    { key: "1:1", label: "1:1", w: 1, h: 1 },
    { key: "book", label: "판형", w: pageW, h: PAGE_H },
  ];

  const [ratio, setRatio] = useState<Ratio>(RATIOS[0]);
  const { w: cw, h: ch } = canvasDims(ratio);

  const apiRef = useRef<FabricApi | null>(null);
  const [selected, setSelected] = useState<FabricObject | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [bgColor, setBgColor] = useState("#ffffff");
  // Bump on every canvas mutation so the props panel re-reads the selection.
  const [, setTick] = useState(0);

  // Preserve the work across a ratio switch: FabricCanvas is keyed by ratio so
  // it remounts at the new size; we stash the serialized state and replay it
  // (or seed the cover on first mount) once the new canvas is ready.
  const carryRef = useRef<object | null>(null);
  const imgInputRef = useRef<HTMLInputElement | null>(null);

  // ---- Fit the (full-res) canvas into the stage with a CSS scale. ----
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      const availW = el.clientWidth - 32;
      const availH = el.clientHeight - 32;
      setScale(Math.max(0.05, Math.min(availW / cw, availH / ch)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cw, ch]);

  // ---- Seed the cover image (centered, covering the canvas). ----
  const seedCover = useCallback(
    async (api: FabricApi) => {
      const url = await renderCoverThumb(coverPage, pageW);
      const c = api.canvas;
      if (!url || !c) return;
      const fabric = await import("fabric");
      const img = await fabric.FabricImage.fromURL(url, {
        crossOrigin: "anonymous",
      });
      fitCover(img, cw, ch);
      c.add(img);
      c.requestRenderAll();
    },
    [coverPage, pageW, cw, ch],
  );

  const handleReady = useCallback(
    (api: FabricApi) => {
      apiRef.current = api;
      const carried = carryRef.current;
      if (carried) {
        // Ratio switch: replay the work, then re-fit the cover (bottom-most
        // image) to the new canvas so it doesn't look broken/mis-scaled.
        void api.load(carried).then(() => {
          carryRef.current = null;
          const c = api.canvas;
          const first = c?.getObjects()?.[0];
          if (
            first &&
            (first as unknown as { type?: string }).type === "image"
          ) {
            fitCover(first, cw, ch);
          }
          c?.requestRenderAll();
        });
      } else {
        void seedCover(api);
      }
    },
    [seedCover, cw, ch],
  );

  // Switch ratio: stash current work, then remount the canvas at the new size.
  const switchRatio = useCallback((r: Ratio) => {
    const api = apiRef.current;
    if (api?.canvas) carryRef.current = api.serialize();
    setSelected(null);
    setRatio(r);
  }, []);

  // ---- Tools ----
  const addText = useCallback(async () => {
    const api = apiRef.current;
    if (!api?.canvas) return;
    const fabric = await import("fabric");
    await ensureFont(DEFAULT_FONT.family);
    const t = new fabric.IText("내용을 입력", {
      left: cw / 2,
      top: ch / 2,
      originX: "center",
      originY: "center",
      fontSize: Math.round(ch / 12),
      fontFamily: DEFAULT_FONT.family,
      fontWeight: "bold",
      fill: "#222222",
      textAlign: "center",
    });
    api.canvas.add(t);
    api.canvas.setActiveObject(t);
    api.canvas.requestRenderAll();
  }, [cw, ch]);

  const addImageFile = useCallback(
    async (file: File) => {
      const api = apiRef.current;
      if (!api?.canvas) return;
      const url = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(file);
      });
      const fabric = await import("fabric");
      const img = await fabric.FabricImage.fromURL(url, {
        crossOrigin: "anonymous",
      });
      const iw = img.width ?? 1;
      const ih = img.height ?? 1;
      // Fit inside ~70% of the canvas, centered.
      const s = Math.min((cw * 0.7) / iw, (ch * 0.7) / ih);
      img.set({
        scaleX: s,
        scaleY: s,
        left: cw / 2,
        top: ch / 2,
        originX: "center",
        originY: "center",
      });
      api.canvas.add(img);
      api.canvas.setActiveObject(img);
      api.canvas.requestRenderAll();
    },
    [cw, ch],
  );

  const addShape = useCallback(
    async (kind: "rect" | "circle") => {
      const api = apiRef.current;
      if (!api?.canvas) return;
      const fabric = await import("fabric");
      const size = Math.round(Math.min(cw, ch) / 3);
      const shape =
        kind === "rect"
          ? new fabric.Rect({
              left: cw / 2,
              top: ch / 2,
              originX: "center",
              originY: "center",
              width: size * 1.4,
              height: size,
              rx: 16,
              ry: 16,
              fill: "#7b74d9",
            })
          : new fabric.Circle({
              left: cw / 2,
              top: ch / 2,
              originX: "center",
              originY: "center",
              radius: size / 2,
              fill: "#f06f5f",
            });
      api.canvas.add(shape);
      api.canvas.setActiveObject(shape);
      api.canvas.requestRenderAll();
    },
    [cw, ch],
  );

  const setBg = useCallback((color: string) => {
    setBgColor(color);
    const api = apiRef.current;
    if (!api?.canvas) return;
    api.canvas.backgroundColor = color;
    api.canvas.requestRenderAll();
  }, []);

  const update = useCallback(
    (patch: Record<string, unknown>) => {
      const api = apiRef.current;
      if (!api?.canvas || !selected) return;
      selected.set(patch);
      (selected as unknown as { initDimensions?: () => void }).initDimensions?.();
      api.canvas.requestRenderAll();
      setTick((x) => x + 1);
    },
    [selected],
  );

  const removeSelected = useCallback(() => {
    const api = apiRef.current;
    if (!api?.canvas || !selected) return;
    api.canvas.remove(selected);
    setSelected(null);
    api.canvas.requestRenderAll();
  }, [selected]);

  const reorder = useCallback(
    (dir: "front" | "back") => {
      const api = apiRef.current;
      const c = api?.canvas;
      if (!c || !selected) return;
      if (dir === "front") c.bringObjectToFront(selected);
      else c.sendObjectToBack(selected);
      c.requestRenderAll();
      setTick((x) => x + 1);
    },
    [selected],
  );

  // Fit/align the selected object to the canvas — "fill" covers the whole
  // canvas (like 전체), the others keep the current scale and pin a horizontal
  // edge (왼쪽/가운데/오른쪽), via a bounding-rect delta so origin doesn't matter.
  const fitTo = useCallback(
    (mode: "fill" | "left" | "center" | "right") => {
      const api = apiRef.current;
      const c = api?.canvas;
      if (!c || !selected) return;
      if (mode === "fill") {
        fitCover(selected, cw, ch);
      } else {
        selected.setCoords();
        const r = selected.getBoundingRect();
        const targetLeft =
          mode === "left"
            ? 0
            : mode === "right"
              ? cw - r.width
              : (cw - r.width) / 2;
        selected.set({ left: (selected.left ?? 0) + (targetLeft - r.left) });
        selected.setCoords();
      }
      c.requestRenderAll();
      setTick((x) => x + 1);
    },
    [selected, cw, ch],
  );

  const download = useCallback(() => {
    const api = apiRef.current;
    if (!api?.canvas) return;
    api.canvas.discardActiveObject();
    api.canvas.requestRenderAll();
    setSelected(null);
    const url = api.toPng(2); // 2× → crisp export
    const a = document.createElement("a");
    a.href = url;
    a.download = `썸네일-${ratio.key.replace(":", "x")}.png`;
    a.click();
  }, [ratio.key]);

  // Esc closes; Delete/Backspace removes the selected object — but not while
  // editing text or typing into a form field (color/range/select).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const el = document.activeElement;
        const tag = el?.tagName;
        if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
        const editing = (apiRef.current?.canvas?.getActiveObject() as unknown as {
          isEditing?: boolean;
        } | null)?.isEditing;
        if (editing) return;
        if (apiRef.current?.canvas?.getActiveObject()) {
          e.preventDefault();
          removeSelected();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, removeSelected]);

  const isText =
    !!selected &&
    ["i-text", "text", "textbox"].includes(
      (selected as unknown as { type?: string }).type ?? "",
    );
  const isImage =
    !!selected && (selected as unknown as { type?: string }).type === "image";
  const fill =
    (selected as unknown as { fill?: string } | null)?.fill ?? "#222222";
  const rawStroke = (selected as unknown as { stroke?: string | null } | null)
    ?.stroke;
  const strokeWidth =
    (selected as unknown as { strokeWidth?: number } | null)?.strokeWidth ?? 0;
  const outlineOn = !!rawStroke && strokeWidth > 0;
  const shadowOn = !!(selected as unknown as { shadow?: unknown } | null)
    ?.shadow;

  return (
    <div className="thumb-backdrop" onClick={onClose}>
      <div
        className="thumb-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="썸네일 만들기"
      >
        <header className="thumb-modal__head">
          <strong>썸네일 만들기</strong>
          <div className="thumb-ratios">
            {RATIOS.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`thumb-ratio-btn${
                  r.key === ratio.key ? " is-active" : ""
                }`}
                onClick={() => switchRatio(r)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="thumb-close"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </header>

        <div className="thumb-toolbar">
          <button type="button" className="ed-tool" onClick={addText}>
            <TypeIcon size={16} /> 글자
          </button>
          <button
            type="button"
            className="ed-tool"
            onClick={() => imgInputRef.current?.click()}
          >
            <ImageIcon size={16} /> 그림
            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void addImageFile(f);
                e.target.value = "";
              }}
            />
          </button>
          <button
            type="button"
            className="ed-tool"
            onClick={() => void addShape("rect")}
          >
            <SquareIcon size={16} /> 네모
          </button>
          <button
            type="button"
            className="ed-tool"
            onClick={() => void addShape("circle")}
          >
            <CircleIcon size={16} /> 동그라미
          </button>
          <label className="ed-tool">
            배경
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBg(e.target.value)}
              style={{ width: 22, height: 22, border: 0, background: "none" }}
            />
          </label>
        </div>

        <div className="thumb-body">
          <div className="thumb-stage" ref={stageRef}>
            <div
              className="thumb-frame"
              style={{ width: Math.floor(cw * scale), height: Math.floor(ch * scale) }}
            >
              {/* Key the React-owned wrapper (not FabricCanvas) so a ratio
                  switch remounts the canvas by removing THIS div — React never
                  has to removeChild the <canvas> that Fabric has re-parented
                  into its own wrapper (that's the removeChild NotFoundError). */}
              <div
                key={ratio.key}
                style={{
                  width: cw,
                  height: ch,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <FabricCanvas
                  pageW={cw}
                  pageH={ch}
                  onReady={handleReady}
                  onSelection={setSelected}
                  onChange={() => setTick((x) => x + 1)}
                  onGuides={setGuides}
                />
              </div>
              {guides.map((g, i) =>
                g.axis === "x" ? (
                  <div
                    key={`gx-${i}`}
                    className="ed-guide ed-guide--x"
                    style={{ left: g.pos * scale }}
                  />
                ) : (
                  <div
                    key={`gy-${i}`}
                    className="ed-guide ed-guide--y"
                    style={{ top: g.pos * scale }}
                  />
                ),
              )}
            </div>
          </div>

          <aside className="thumb-props">
            {!selected && (
              <p className="thumb-hint">
                표지에서 가져온 이미지예요. 글자·그림을 더하고 비율을 골라
                썸네일을 만들어 보세요. 요소를 선택하면 여기서 꾸밀 수 있어요.
                <br />
                <br />
                요소를 누른 뒤 <b>Delete</b> 키 또는 아래 <b>삭제</b> 버튼으로
                지울 수 있어요.
              </p>
            )}
            {selected && (
              <>
                {isText && (
                  <>
                    <div className="thumb-field">
                      <label className="ed-props__label">글꼴</label>
                      <select
                        className="ed-select"
                        value={
                          (selected as unknown as { fontFamily?: string })
                            .fontFamily ?? DEFAULT_FONT.family
                        }
                        onChange={async (e) => {
                          const family = e.target.value;
                          await ensureFont(family);
                          update({ fontFamily: family });
                        }}
                      >
                        {groupFonts().map(({ group, items }) => (
                          <optgroup key={group} label={group}>
                            {items.map((f) => (
                              <option key={f.family} value={f.family}>
                                {f.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div className="thumb-field">
                      <label className="ed-props__label">글자색</label>
                      <input
                        type="color"
                        className="thumb-swatch"
                        value={toHexColor(fill)}
                        onChange={(e) => update({ fill: e.target.value })}
                      />
                    </div>
                    <div className="thumb-field">
                      <label className="ed-props__label">크기</label>
                      <input
                        type="range"
                        className="thumb-range"
                        min={12}
                        max={Math.round(ch / 2)}
                        value={
                          (selected as unknown as { fontSize?: number })
                            .fontSize ?? 40
                        }
                        onChange={(e) =>
                          update({ fontSize: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="thumb-field">
                      <label className="ed-props__label">두께 · 정렬</label>
                      <div className="thumb-seg">
                        <button
                          type="button"
                          className={
                            (selected as unknown as { fontWeight?: string })
                              .fontWeight === "bold"
                              ? "is-on"
                              : ""
                          }
                          onClick={() =>
                            update({
                              fontWeight:
                                (selected as unknown as { fontWeight?: string })
                                  .fontWeight === "bold"
                                  ? "normal"
                                  : "bold",
                            })
                          }
                          title="굵게"
                        >
                          <Bold size={14} />
                        </button>
                        {(
                          [
                            ["left", AlignLeft],
                            ["center", AlignCenter],
                            ["right", AlignRight],
                          ] as const
                        ).map(([a, Icon]) => (
                          <button
                            key={a}
                            type="button"
                            className={
                              (selected as unknown as { textAlign?: string })
                                .textAlign === a
                                ? "is-on"
                                : ""
                            }
                            onClick={() => update({ textAlign: a })}
                          >
                            <Icon size={14} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {!isText && (
                  <div className="thumb-field">
                    <label className="ed-props__label">색</label>
                    <input
                      type="color"
                      className="thumb-swatch"
                      value={toHexColor(fill)}
                      onChange={(e) => update({ fill: e.target.value })}
                    />
                  </div>
                )}
                {isImage && (
                  <div className="thumb-field">
                    <label className="ed-props__label">맞춤</label>
                    <div className="thumb-seg">
                      <button type="button" onClick={() => fitTo("fill")}>
                        전체
                      </button>
                      <button type="button" onClick={() => fitTo("left")}>
                        왼쪽
                      </button>
                      <button type="button" onClick={() => fitTo("center")}>
                        가운데
                      </button>
                      <button type="button" onClick={() => fitTo("right")}>
                        오른쪽
                      </button>
                    </div>
                  </div>
                )}
                <div className="thumb-field">
                  <div className="thumb-field__head">
                    <label className="ed-props__label">외곽선</label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={outlineOn}
                      className={`ed-switch${outlineOn ? " is-on" : ""}`}
                      onClick={() =>
                        outlineOn
                          ? update({ stroke: null, strokeWidth: 0 })
                          : update({
                              stroke: "#ffffff",
                              strokeWidth: Math.max(2, Math.round(ch / 120)),
                              paintFirst: "stroke",
                            })
                      }
                    >
                      <span className="ed-switch__knob" />
                    </button>
                  </div>
                  {outlineOn && (
                    <input
                      type="color"
                      className="thumb-swatch"
                      value={toHexColor(rawStroke, "#ffffff")}
                      onChange={(e) =>
                        update({ stroke: e.target.value, paintFirst: "stroke" })
                      }
                    />
                  )}
                </div>
                <div className="thumb-field">
                  <div className="thumb-field__head">
                    <label className="ed-props__label">그림자</label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={shadowOn}
                      className={`ed-switch${shadowOn ? " is-on" : ""}`}
                      onClick={() =>
                        update({
                          shadow: shadowOn
                            ? null
                            : "rgba(0,0,0,0.35) 0px 4px 12px",
                        })
                      }
                    >
                      <span className="ed-switch__knob" />
                    </button>
                  </div>
                </div>
                <div className="thumb-field">
                  <label className="ed-props__label">정돈</label>
                  <div className="thumb-seg">
                    <button
                      type="button"
                      onClick={() => reorder("front")}
                      title="맨 앞으로"
                    >
                      <BringToFront size={14} /> 앞으로
                    </button>
                    <button
                      type="button"
                      onClick={() => reorder("back")}
                      title="맨 뒤로"
                    >
                      <SendToBack size={14} /> 뒤로
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="thumb-del"
                  onClick={removeSelected}
                >
                  <Trash2 size={15} /> 삭제
                </button>
              </>
            )}
          </aside>
        </div>

        <footer className="thumb-modal__foot">
          <button type="button" className="ed-home" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="ed-finish" onClick={download}>
            <Download size={16} /> 다운로드
          </button>
        </footer>
      </div>
    </div>
  );
}
