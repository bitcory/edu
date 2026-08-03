import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  PAGES_PER_BOOK,
  getAction,
  getCharacter,
  getLocation,
} from "../../../../lib/make-catalog";

/**
 * 「그림책 만들기」 그림을 고정 URL로 서빙한다.
 *
 * /api/files 의 서명 URL과 달리 만료가 없다 — 이 URL은 책 스냅샷 안에 박혀
 * 영구 보존되므로 만료되면 나중에 책이 깨진다. 인증은 proxy 의 세션 게이트가
 * 담당한다(이 경로는 matcher 에 포함된다).
 *
 * 실제 파일이 아직 없으면 라벨이 박힌 SVG 플레이스홀더를 즉석 생성해 돌려준다.
 * 덕분에 그림 328장을 채우기 전에도 전체 흐름이 그대로 동작하고, 더미 파일을
 * 만들어 두었다가 지우는 과정도 필요 없다. 파일을 넣는 순간 대체된다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/** 만들 수 있는 조합만 통과시킨다 — 경로 탐색 방지 + 오타 조기 발견. */
function describe(segments: string[]): { label: string; emoji: string } | null {
  const [kind, a, b] = segments;
  if (segments.length === 2) {
    if (kind === "characters") {
      const c = getCharacter(a);
      return c ? { label: c.label, emoji: c.emoji } : null;
    }
    if (kind === "actions") {
      const x = getAction(a);
      return x ? { label: x.label, emoji: x.emoji } : null;
    }
    if (kind === "locations") {
      const l = getLocation(a);
      return l ? { label: l.label, emoji: l.emoji } : null;
    }
    return null;
  }
  if (segments.length === 3 && kind === "scenes") {
    const [charId, actId, locId] = a.split("__");
    const c = getCharacter(charId);
    const x = getAction(actId);
    const l = getLocation(locId);
    const page = Number(b);
    if (!c || !x || !l) return null;
    if (!Number.isInteger(page) || page < 1 || page > PAGES_PER_BOOK) return null;
    return {
      label: `${c.label} · ${l.label} · ${x.label}\n${page} / ${PAGES_PER_BOOK} 쪽`,
      emoji: c.emoji,
    };
  }
  return null;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (ch) =>
    ch === "<"
      ? "&lt;"
      : ch === ">"
        ? "&gt;"
        : ch === "&"
          ? "&amp;"
          : ch === '"'
            ? "&quot;"
            : "&apos;",
  );
}

/** 아직 그림이 없는 자리를 채우는 4:5 세로 플레이스홀더. 어떤 그림을 어디에
 * 넣어야 하는지 그림 위에 그대로 적어 둔다. */
function placeholderSvg(
  label: string,
  emoji: string,
  filePath: string,
): string {
  const lines = label.split("\n");
  const body = lines
    .map(
      (line, i) =>
        `<text x="400" y="${560 + i * 52}" font-size="34" font-weight="700" fill="#7b5c3e" text-anchor="middle" font-family="sans-serif">${escapeXml(line)}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff3d6"/>
      <stop offset="1" stop-color="#ffd9c2"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#g)"/>
  <rect x="24" y="24" width="752" height="952" rx="28" fill="none" stroke="#e0b48e" stroke-width="4" stroke-dasharray="16 12"/>
  <text x="400" y="440" font-size="180" text-anchor="middle" font-family="sans-serif">${escapeXml(emoji)}</text>
  ${body}
  <text x="400" y="880" font-size="20" fill="#a9866a" text-anchor="middle" font-family="monospace">${escapeXml(filePath)}</text>
  <text x="400" y="920" font-size="22" fill="#b08968" text-anchor="middle" font-family="sans-serif">여기에 그림을 넣어 주세요</text>
</svg>`;
}

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/make/img/[...path]">,
) {
  const { path: segments } = await ctx.params;
  const meta = describe(segments);
  if (!meta) return new Response(null, { status: 404 });

  const root = process.env.STORAGE_DIR;
  const relative = segments.join("/");

  if (root) {
    for (const ext of EXTENSIONS) {
      const file = path.join(root, "make", `${relative}${ext}`);
      try {
        const s = await stat(file);
        if (!s.isFile()) continue;
        const bytes = await readFile(file);
        return new Response(new Uint8Array(bytes), {
          headers: {
            "content-type": CONTENT_TYPES[ext],
            "content-length": String(s.size),
            // 내용이 바뀌면 파일을 덮어쓰므로 너무 길게 잡지 않는다.
            "cache-control": "private, max-age=3600",
          },
        });
      } catch {
        /* 다음 확장자 시도 */
      }
    }
  }

  const svg = placeholderSvg(
    meta.label,
    meta.emoji,
    `make/${relative}.png`,
  );
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // 진짜 그림을 넣는 즉시 보이도록 캐시하지 않는다.
      "cache-control": "no-store",
    },
  });
}
