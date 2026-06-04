"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { Canvas, FabricObject } from "fabric";
import { PAGE_H, PAGE_W } from "../../lib/editor-types";

export type Guide = {
  axis: "x" | "y";
  /** Position in canvas-pixel space. */
  pos: number;
};

export type FabricApi = {
  canvas: Canvas | null;
  /** Load a serialized state into the canvas; pass null to clear. */
  load: (data: object | null) => Promise<void>;
  /** Serialize current canvas state. */
  serialize: () => object;
  /** Render and return a PNG data URL at backing-pixel resolution. */
  toPng: (multiplier?: number) => string;
};

type Props = {
  onReady: (api: FabricApi) => void;
  onSelection: (obj: FabricObject | null) => void;
  onChange: () => void;
  /** Active snap guides — empty array when nothing is being dragged. */
  onGuides: (guides: Guide[]) => void;
  /** Page width. Varies by 판형. */
  pageW?: number;
  /** Page height (defaults to PAGE_H). Lets non-book canvases (e.g. the
   *  thumbnail tool) use arbitrary aspect ratios. */
  pageH?: number;
};

/** Snap threshold in canvas-pixel space — how close an edge has to get to a
 *  target before it locks in. Higher = stickier feeling. */
const SNAP_THRESHOLD = 14;

export default forwardRef<FabricApi | null, Props>(function FabricCanvas(
  { onReady, onSelection, onChange, onGuides, pageW = PAGE_W, pageH = PAGE_H },
  ref,
) {
  const elRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const apiRef = useRef<FabricApi | null>(null);
  // Where the dragged object started — used to lock the axis on Shift-drag.
  const dragStartRef = useRef<{ left: number; top: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let canvas: Canvas | null = null;

    (async () => {
      const fabric = await import("fabric");
      if (cancelled || !elRef.current) return;

      canvas = new fabric.Canvas(elRef.current, {
        width: pageW,
        height: pageH,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
      });
      canvasRef.current = canvas;

      // Make the resize handles visible and easy to grab. The default Fabric
      // corners are tiny transparent squares — hard to find, especially the
      // middle one on a tall thin image.
      const HANDLE_STYLE = {
        transparentCorners: false,
        cornerColor: "#1f9e7f",
        cornerStrokeColor: "#ffffff",
        cornerStyle: "circle" as const,
        cornerSize: 12,
        touchCornerSize: 44,
        borderColor: "#1f9e7f",
      };

      // Stretch the side controls' HIT AREA to span (most of) the edge, so you
      // can grab anywhere along the left/right line to resize horizontally (and
      // top/bottom to resize vertically) instead of hunting for the tiny middle
      // square. A margin is left at each end so the corner handles (tl/tr/bl/br)
      // still win there for diagonal resize. Sizes are in screen px.
      const sizeEdgeControls = (obj: FabricObject | null | undefined) => {
        if (!obj || !obj.controls) return;
        const zoom = canvas?.getZoom?.() ?? 1;
        const cs = obj.cornerSize ?? 12;
        const margin = obj.touchCornerSize ?? 44; // reserve the corners
        const edgeY = Math.max(cs, obj.getScaledHeight() * zoom - margin * 2);
        const edgeX = Math.max(cs, obj.getScaledWidth() * zoom - margin * 2);
        const c = obj.controls as Record<
          string,
          { sizeX: number; sizeY: number; touchSizeX: number; touchSizeY: number }
        >;
        const setY = (ctrl?: { sizeY: number; touchSizeY: number }) => {
          if (ctrl) {
            ctrl.sizeY = edgeY;
            ctrl.touchSizeY = edgeY;
          }
        };
        const setX = (ctrl?: { sizeX: number; touchSizeX: number }) => {
          if (ctrl) {
            ctrl.sizeX = edgeX;
            ctrl.touchSizeX = edgeX;
          }
        };
        setY(c.ml);
        setY(c.mr);
        setX(c.mt);
        setX(c.mb);
        obj.setCoords();
      };

      const tuneObject = (obj: FabricObject | null | undefined) => {
        if (!obj) return;
        obj.set(HANDLE_STYLE);
        sizeEdgeControls(obj);
      };

      const emitSelection = () => {
        const active = canvas?.getActiveObject() ?? null;
        onSelection(active ?? null);
      };
      canvas.on("selection:created", emitSelection);
      canvas.on("selection:updated", emitSelection);
      canvas.on("selection:cleared", () => onSelection(null));
      canvas.on("object:modified", onChange);
      canvas.on("object:added", onChange);
      canvas.on("object:removed", onChange);

      // Keep handles styled + edge hit-areas sized to each object.
      canvas.on("object:added", (e) => tuneObject(e.target as FabricObject));
      canvas.on("selection:created", () =>
        sizeEdgeControls(canvas?.getActiveObject()),
      );
      canvas.on("selection:updated", () =>
        sizeEdgeControls(canvas?.getActiveObject()),
      );
      canvas.on("object:scaling", (e) =>
        sizeEdgeControls(e.target as FabricObject),
      );
      canvas.on("object:modified", (e) =>
        sizeEdgeControls(e.target as FabricObject),
      );

      // --- Snap-to-guides while moving ---
      const collectTargets = (skip: FabricObject) => {
        // Canvas edges + center + quarter marks for richer alignment.
        const xs: number[] = [
          0,
          pageW / 4,
          pageW / 2,
          (3 * pageW) / 4,
          pageW,
        ];
        const ys: number[] = [
          0,
          pageH / 4,
          pageH / 2,
          (3 * pageH) / 4,
          pageH,
        ];
        for (const o of canvas!.getObjects()) {
          if (o === skip) continue;
          const r = o.getBoundingRect();
          xs.push(r.left, r.left + r.width / 2, r.left + r.width);
          ys.push(r.top, r.top + r.height / 2, r.top + r.height);
        }
        return { xs, ys };
      };

      canvas.on("mouse:down", (ev) => {
        const t = ev.target as FabricObject | undefined;
        dragStartRef.current = t
          ? { left: t.left ?? 0, top: t.top ?? 0 }
          : null;
      });

      canvas.on("object:moving", (ev) => {
        const target = ev.target as FabricObject | undefined;
        if (!target) return;

        // Shift-drag → lock to one axis (the direction dragged the most),
        // e.g. slide a full-bleed image perfectly horizontally.
        const pointerEv = ev.e as { shiftKey?: boolean } | undefined;
        const start = dragStartRef.current;
        if (pointerEv?.shiftKey && start) {
          const dxTotal = (target.left ?? 0) - start.left;
          const dyTotal = (target.top ?? 0) - start.top;
          if (Math.abs(dxTotal) >= Math.abs(dyTotal)) {
            target.set("top", start.top); // horizontal only
          } else {
            target.set("left", start.left); // vertical only
          }
          target.setCoords();
          onGuides([]);
          return; // skip snapping while axis-locked
        }

        const r = target.getBoundingRect();
        const { xs, ys } = collectTargets(target);
        const guides: Guide[] = [];

        // X axis: try left/center/right edges
        const xCandidates: Array<[number, number]> = [
          [r.left, 0],
          [r.left + r.width / 2, r.width / 2],
          [r.left + r.width, r.width],
        ];
        let dx = 0;
        let bestDxAbs = SNAP_THRESHOLD + 1;
        let snappedXPos: number | null = null;
        for (const [edge, edgeOffsetFromLeft] of xCandidates) {
          for (const tx of xs) {
            const diff = tx - edge;
            const ad = Math.abs(diff);
            if (ad < bestDxAbs) {
              bestDxAbs = ad;
              dx = diff;
              snappedXPos = tx;
              // also record that this offset becomes the snapped edge
              void edgeOffsetFromLeft;
            }
          }
        }
        // Skip x-snapping for objects as wide as / wider than the page (full-
        // bleed images): their left/center/right edges all sit near the page
        // guides at once, so the snap target flips frame-to-frame → jitter.
        if (r.width < pageW - 0.5 && bestDxAbs <= SNAP_THRESHOLD) {
          target.set("left", target.left + dx);
          if (snappedXPos !== null) guides.push({ axis: "x", pos: snappedXPos });
        }

        const yCandidates: Array<[number, number]> = [
          [r.top, 0],
          [r.top + r.height / 2, r.height / 2],
          [r.top + r.height, r.height],
        ];
        let dy = 0;
        let bestDyAbs = SNAP_THRESHOLD + 1;
        let snappedYPos: number | null = null;
        for (const [edge, edgeOffsetFromTop] of yCandidates) {
          for (const ty of ys) {
            const diff = ty - edge;
            const ad = Math.abs(diff);
            if (ad < bestDyAbs) {
              bestDyAbs = ad;
              dy = diff;
              snappedYPos = ty;
              void edgeOffsetFromTop;
            }
          }
        }
        if (r.height < pageH - 0.5 && bestDyAbs <= SNAP_THRESHOLD) {
          target.set("top", target.top + dy);
          if (snappedYPos !== null) guides.push({ axis: "y", pos: snappedYPos });
        }

        target.setCoords();
        onGuides(guides);
      });
      canvas.on("mouse:up", () => onGuides([]));
      canvas.on("mouse:out", () => onGuides([]));

      const api: FabricApi = {
        get canvas() {
          return canvasRef.current;
        },
        load: async (data) => {
          const c = canvasRef.current;
          if (!c) return;
          if (!data) {
            c.clear();
            c.backgroundColor = "#ffffff";
            c.renderAll();
            return;
          }
          await c.loadFromJSON(data);
          // Loaded objects are fresh instances — restyle their handles and
          // size the edge hit-areas so the whole-edge grab works after reload.
          c.getObjects().forEach((o) => tuneObject(o));
          c.renderAll();
        },
        // Include the custom `caption` flag so auto-added 내용추가 text stays
        // identifiable across save/reload (lets 내용추가 replace/clear only its
        // own text, not text the user typed by hand). fabric's toObject keeps
        // listed props (pick) and _setOptions restores them on load.
        serialize: () => canvasRef.current?.toObject(["caption"]) ?? {},
        toPng: (multiplier = 1) =>
          canvasRef.current?.toDataURL({
            format: "png",
            multiplier,
          }) ?? "",
      };
      apiRef.current = api;
      onReady(api);
    })();

    return () => {
      cancelled = true;
      const c = canvasRef.current;
      if (c) {
        c.dispose();
        canvasRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle<FabricApi | null, FabricApi | null>(
    ref,
    () => apiRef.current,
    [],
  );

  return <canvas ref={elRef} className="ed-canvas" />;
});
