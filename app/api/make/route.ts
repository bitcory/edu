import { getServerUser } from "../../lib/server-auth";
import { insertBook, setBookCover } from "../../lib/books-repo";
import { copyCoverFromKey } from "../../lib/pdf-storage";
import { PAGE_H, PAGE_W, type EditorPage } from "../../lib/editor-types";
import {
  BEATS,
  PAGES_PER_BOOK,
  bookTitle,
  getAction,
  getCharacter,
  getLocation,
  characterImageUrl,
  sceneImageUrl,
  withJosa,
  type Action,
  type Character,
  type Location,
} from "../../lib/make-catalog";

/**
 * 객관식 선택 → 완성된 그림책 1권.
 *
 * 그림은 미리 만들어 둔 것을 고르기만 하므로 생성 대기가 없다. 페이지는
 * 에디터가 쓰는 것과 똑같은 Fabric 스냅샷이라, 기존 뷰어·PDF 내보내기·
 * 내레이션이 그대로 동작한다.
 *
 * 이미지 src 는 서명 없는 고정 URL(/api/make/img/...)이다. 스냅샷은 영구
 * 보존되므로 만료되는 URL을 박으면 나중에 책이 깨진다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY_FONT = "GowunDodum";
const TITLE_FONT = "Cafe24Ssurround";
const INK = "#3a2a1d";

/** 아이 이름 — 화면과 문장에 그대로 박히므로 길이와 문자를 제한한다. */
const NAME_RE = /^[가-힣a-zA-Z][가-힣a-zA-Z0-9 ]{0,9}$/;

function pageId(): string {
  return globalThis.crypto.randomUUID().slice(0, 8);
}

/** 페이지를 꽉 채우는 배경 그림.
 *
 * width/height 를 명시하면 Fabric 이 그 크기로 늘려 그린다. 원본이 4:5 이기만
 * 하면(1024×1280 권장) 비율이 같아 왜곡이 없다 — 그래서 프롬프트 문서가 4:5 를
 * 요구한다. 아직 그림이 없으면 라우트가 같은 4:5 플레이스홀더를 돌려준다. */
function imageObject(src: string) {
  return {
    type: "Image",
    src,
    left: 0,
    top: 0,
    width: PAGE_W,
    height: PAGE_H,
    scaleX: 1,
    scaleY: 1,
    selectable: false,
    evented: false,
    crossOrigin: null,
  };
}

/** 문장을 얹는 반투명 흰 띠 + 글자. 그림 위 아무 데나 글자를 놓으면 배경색에
 * 따라 안 읽히므로, 하단에 고정 띠를 깔고 그 안에 쓴다. */
function captionObjects(text: string) {
  return [
    {
      type: "Rect",
      left: 48,
      top: 792,
      width: PAGE_W - 96,
      height: 160,
      rx: 32,
      ry: 32,
      fill: "rgba(255,255,255,0.88)",
      selectable: false,
      evented: false,
    },
    {
      type: "Textbox",
      text,
      left: 88,
      top: 828,
      width: PAGE_W - 176,
      fontSize: 42,
      lineHeight: 1.35,
      fontFamily: BODY_FONT,
      fill: INK,
      textAlign: "center",
      selectable: false,
      evented: false,
    },
  ];
}

function contentPage(src: string, text: string): EditorPage {
  return {
    id: pageId(),
    kind: "content",
    data: {
      version: "6.9.1",
      background: "#ffffff",
      objects: [imageObject(src), ...captionObjects(text)],
    },
  };
}

function coverPage(src: string, title: string, author: string): EditorPage {
  return {
    id: pageId(),
    kind: "cover",
    data: {
      version: "6.9.1",
      background: "#ffffff",
      objects: [
        imageObject(src),
        {
          type: "Rect",
          left: 48,
          top: 640,
          width: PAGE_W - 96,
          height: 260,
          rx: 36,
          ry: 36,
          fill: "rgba(255,255,255,0.9)",
          selectable: false,
          evented: false,
        },
        {
          type: "Textbox",
          text: title,
          left: 88,
          top: 682,
          width: PAGE_W - 176,
          fontSize: 58,
          lineHeight: 1.3,
          fontFamily: TITLE_FONT,
          fontWeight: "bold",
          fill: INK,
          textAlign: "center",
          selectable: false,
          evented: false,
        },
        {
          type: "Textbox",
          text: author,
          left: 88,
          top: 838,
          width: PAGE_W - 176,
          fontSize: 28,
          fontFamily: BODY_FONT,
          fill: "#7b5c3e",
          textAlign: "center",
          selectable: false,
          evented: false,
        },
      ],
    },
  };
}

function buildPages(
  name: string,
  character: Character,
  action: Action,
  location: Location,
): EditorPage[] {
  const beats = BEATS[action.id];
  const pages: EditorPage[] = [
    // 표지는 캐릭터 시트를 쓴다. 1쪽 장면을 재사용하면 양면 보기에서 똑같은
    // 그림이 나란히 붙어 버린다.
    coverPage(
      characterImageUrl(character.id),
      bookTitle(name, action, location),
      `${withJosa(name, "과와")} ${character.label} 이야기`,
    ),
  ];
  for (let i = 0; i < PAGES_PER_BOOK; i++) {
    pages.push(
      contentPage(
        sceneImageUrl(character.id, action.id, location.id, i + 1),
        beats[i].text(name, location),
      ),
    );
  }
  return pages;
}

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const character = getCharacter(String(body.character ?? ""));
  const action = getAction(String(body.action ?? ""));
  const location = getLocation(String(body.location ?? ""));
  const name = String(body.name ?? "").trim();

  if (!character || !action || !location) {
    return Response.json({ error: "선택을 다시 확인해 주세요." }, { status: 400 });
  }
  if (!NAME_RE.test(name)) {
    return Response.json(
      { error: "이름은 한글 또는 영문 1~10자로 넣어 주세요." },
      { status: 400 },
    );
  }

  const pages = buildPages(name, character, action, location);
  // 'draft' = 내 서재에만 보이는 개인 책. 아이가 만든 책이 스토어 승인 대기열로
  // 흘러가지 않게 한다.
  const book = await insertBook(
    {
      title: bookTitle(name, action, location),
      author: name,
      description: `${character.label}와 함께 ${location.label}에서 ${action.label}`,
      category: "그림책",
      price: 0,
      pageW: PAGE_W,
      layout: "spread",
      pages,
    },
    { id: user.id, name: user.name },
    "draft",
  );

  // 표지 썸네일 — 서재·스토어 목록이 cover_key 를 본다. 「그림책 만들기」의
  // 그림은 파일로 들어와 있어 data URL 경로(insertBook 의 coverThumb)를 탈 수
  // 없으므로, 책을 만든 뒤 캐릭터 시트를 표지로 복사한다.
  // 아직 그 그림이 없으면(플레이스홀더) 표지 없이 두고, 나중에 파일을 넣으면
  // 다음에 만드는 책부터 붙는다.
  const coverKey = await copyCoverFromKey(
    book.id,
    `make/characters/${character.id}.png`,
  );
  if (coverKey) await setBookCover(book.id, coverKey);

  return Response.json({ id: book.id, title: book.title });
}
