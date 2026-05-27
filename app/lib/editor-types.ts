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
