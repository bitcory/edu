import { listBooks } from "../../../lib/books-repo";
import { listNotices } from "../../../lib/notices-repo";
import { listActiveBanners } from "../../../lib/banners-repo";
import { listFeatured } from "../../../lib/featured-repo";
import { presignBannerDownload } from "../../../lib/pdf-storage";
import { getServerUser } from "../../../lib/server-auth";
import { BOOK_CATEGORIES } from "../../../lib/categories";
import type { StoreBook } from "../../../lib/book-types";

/** 스토어 포털 홈 데이터 — 공지/배너/금주의 추천/카테고리별 신간을 한 번에.
 * listBooks("store") 한 벌을 서버에서 메모리 분배해 쿼리·presign 중복이 없다. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHELF_SIZE = 6;
const FEATURED_MAX = 3;
const NOTICE_MAX = 5;

const popScore = (b: StoreBook) => (b.likeCount ?? 0) * 3 + (b.viewCount ?? 0);

export async function GET() {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [books, notices, banners, featuredRows] = await Promise.all([
    listBooks("store"), // 승인책 전체 (최신순, presigned cover 포함)
    listNotices(),
    listActiveBanners(),
    listFeatured(),
  ]);

  // 금주의 추천: 관리자 지정(승인 목록에 없는 book_id 는 스킵) + 부족분은
  // 인기점수(좋아요×3+조회수) 상위로 자동 보완.
  const byId = new Map(books.map((b) => [b.id, b]));
  const featured: (StoreBook & { featuredNote: string | null })[] = [];
  for (const f of featuredRows) {
    if (featured.length >= FEATURED_MAX) break;
    const b = byId.get(f.bookId);
    if (b) featured.push({ ...b, featuredNote: f.note });
  }
  if (featured.length < FEATURED_MAX) {
    const picked = new Set(featured.map((p) => p.id));
    for (const b of [...books].sort((a, z) => popScore(z) - popScore(a))) {
      if (featured.length >= FEATURED_MAX) break;
      if (!picked.has(b.id)) featured.push({ ...b, featuredNote: null });
    }
  }

  // 카테고리별 신간 선반 — 책이 있는 카테고리만, BOOK_CATEGORIES 순서.
  // books 는 이미 최신순이므로 filter 후 앞에서 자른다.
  const shelves = BOOK_CATEGORIES.map((category) => {
    const inCat = books.filter((b) => (b.category ?? "") === category);
    return { category, total: inCat.length, books: inCat.slice(0, SHELF_SIZE) };
  }).filter((s) => s.total > 0);

  const bannerOut = await Promise.all(
    banners.map(async (b) => ({
      id: b.id,
      linkUrl: b.linkUrl,
      imageUrl: await presignBannerDownload(b.imageKey),
    })),
  );

  return Response.json({
    notices: notices.slice(0, NOTICE_MAX), // body 포함 (클릭 시 추가 fetch 없음)
    banners: bannerOut,
    featured,
    shelves,
  });
}
