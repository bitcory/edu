export const PAGE_W = 800;
export const PAGE_H = 1000;

export type PageKind = "cover" | "content";

export type EditorPage = {
  id: string;
  kind: PageKind;
  /** Serialized Fabric canvas state (canvas.toJSON()) */
  data: object | null;
  /** Optional cached thumbnail data URL */
  thumb?: string;
  /**
   * Pages split from one continuous spread image (전체추가 on a wide scan)
   * share this id so adjusting the image on one half keeps the other half
   * aligned to the center seam.
   */
  spreadId?: string;
  /** Which half of that spread this page shows. */
  spreadSide?: "left" | "right";
};

export type EditorSnapshot = {
  title: string;
  pages: EditorPage[];
};

export function makePage(kind: PageKind = "content"): EditorPage {
  return {
    id: Math.random().toString(36).slice(2, 10),
    kind,
    data: null,
  };
}
