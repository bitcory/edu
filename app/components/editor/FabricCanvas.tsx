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
};

/** Snap threshold in canvas-pixel space — how close an edge has to get to a
 *  target before it locks in. Higher = stickier feeling. */
const SNAP_THRESHOLD = 14;

export default forwardRef<FabricApi | null, Props>(function FabricCanvas(
  { onReady, onSelection, onChange, onGuides },
  ref,
) {
  const elRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const apiRef = useRef<FabricApi | null>(null);

  useEffect(() => {
    let cancelled = false;
    let canvas: Canvas | null = null;

    (async () => {
      const fabric = await import("fabric");
      if (cancelled || !elRef.current) return;

      canvas = new fabric.Canvas(elRef.current, {
        width: PAGE_W,
        height: PAGE_H,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
      });
      canvasRef.current = canvas;

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

      // --- Snap-to-guides while moving ---
      const collectTargets = (skip: FabricObject) => {
        // Canvas edges + center + quarter marks for richer alignment.
        const xs: number[] = [
          0,
          PAGE_W / 4,
          PAGE_W / 2,
          (3 * PAGE_W) / 4,
          PAGE_W,
        ];
        const ys: number[] = [
          0,
          PAGE_H / 4,
          PAGE_H / 2,
          (3 * PAGE_H) / 4,
          PAGE_H,
        ];
        for (const o of canvas!.getObjects()) {
          if (o === skip) continue;
          const r = o.getBoundingRect();
          xs.push(r.left, r.left + r.width / 2, r.left + r.width);
          ys.push(r.top, r.top + r.height / 2, r.top + r.height);
        }
        return { xs, ys };
      };

      canvas.on("object:moving", (ev) => {
        const target = ev.target as FabricObject | undefined;
        if (!target) return;
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
        if (bestDxAbs <= SNAP_THRESHOLD) {
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
        if (bestDyAbs <= SNAP_THRESHOLD) {
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
          c.renderAll();
        },
        serialize: () => canvasRef.current?.toJSON() ?? {},
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
