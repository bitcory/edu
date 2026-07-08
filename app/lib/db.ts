import { neon } from "@neondatabase/serverless";

/**
 * Server-only Postgres (Neon) access. Set DATABASE_URL to the Neon *pooled*
 * connection string (host contains `-pooler`). The HTTP driver runs each query
 * as a single stateless request — ideal for serverless (Vercel).
 *
 * To keep the repos backend-agnostic, `db.execute()` mimics the old libSQL
 * interface: it takes `?`-style placeholders and `{ rows }` out, converting
 * `?` → `$1, $2, …` for Postgres. Do NOT import this from client components.
 */

export type Row = Record<string, unknown>;
export type ExecuteResult = { rows: Row[] };

// Lazy client: the env check + connection are deferred to the first query, so
// importing this module during `next build` (page-data collection) never throws
// even if DATABASE_URL is absent at build time. The error only surfaces at
// runtime if a query actually runs without the var set.
let _sql: ReturnType<typeof neon> | null = null;
function getSql(): ReturnType<typeof neon> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add the Neon pooled connection string to .env.local (and to the host's env).",
    );
  }
  _sql = neon(url);
  return _sql;
}

/** Rewrite SQLite-style `?` placeholders to Postgres `$1, $2, …`. */
function toPg(text: string): string {
  let i = 0;
  return text.replace(/\?/g, () => `$${++i}`);
}

export const db = {
  async execute(
    query: string | { sql: string; args?: unknown[] },
  ): Promise<ExecuteResult> {
    const sql = getSql();
    if (typeof query === "string") {
      const rows = (await sql.query(query)) as Row[];
      return { rows };
    }
    const rows = (await sql.query(toPg(query.sql), query.args ?? [])) as Row[];
    return { rows };
  },
};

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      // NOTE: timestamps use BIGINT — they hold Date.now() (epoch ms, ~1.7e12),
      // which overflows Postgres' 4-byte INTEGER (max ~2.1e9).
      await db.execute(
        `CREATE TABLE IF NOT EXISTS books (
          id            TEXT PRIMARY KEY,
          title         TEXT NOT NULL,
          kind          TEXT NOT NULL DEFAULT 'editor',
          author        TEXT,
          description   TEXT,
          category      TEXT,
          price         INTEGER NOT NULL DEFAULT 0,
          page_w        INTEGER NOT NULL DEFAULT 800,
          layout        TEXT NOT NULL DEFAULT 'spread',
          owner_id      TEXT NOT NULL,
          owner_name    TEXT NOT NULL,
          pages         TEXT NOT NULL,
          cover_thumb   TEXT,
          status        TEXT NOT NULL,
          submitted_at  BIGINT NOT NULL,
          reviewed_at   BIGINT,
          reject_reason TEXT,
          audio_key     TEXT
        )`,
      );
      // Idempotent column adds (Postgres supports IF NOT EXISTS) — defensive in
      // case an older schema predates these columns.
      for (const ddl of [
        `ADD COLUMN IF NOT EXISTS description TEXT`,
        `ADD COLUMN IF NOT EXISTS price INTEGER NOT NULL DEFAULT 0`,
        `ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'editor'`,
        `ADD COLUMN IF NOT EXISTS page_w INTEGER NOT NULL DEFAULT 800`,
        `ADD COLUMN IF NOT EXISTS layout TEXT NOT NULL DEFAULT 'spread'`,
        `ADD COLUMN IF NOT EXISTS audio_key TEXT`,
        `ADD COLUMN IF NOT EXISTS category TEXT`,
        // Page snapshot now lives in R2 (snapshot_key); pages column kept '[]'.
        // page_count preserves the "N쪽" display without loading the snapshot.
        `ADD COLUMN IF NOT EXISTS snapshot_key TEXT`,
        `ADD COLUMN IF NOT EXISTS page_count INTEGER`,
        // Per-page narration: JSON array of R2 keys (or null) per page index.
        `ADD COLUMN IF NOT EXISTS narration TEXT`,
        // Raw 내용추가 script so re-edits can reload the textarea verbatim.
        `ADD COLUMN IF NOT EXISTS story_text TEXT`,
        // Cover image now lives in R2 (covers/<id>.jpg); cover_thumb (inline
        // base64) is legacy — kept until migrated, then NULL.
        `ADD COLUMN IF NOT EXISTS cover_key TEXT`,
      ]) {
        await db.execute(`ALTER TABLE books ${ddl}`);
      }

      // Author profiles, keyed by Clerk userId.
      // WARNING: rrn / bank_account / biz_no are sensitive 개인정보 stored as
      // PLAINTEXT for the prototype — encrypt (or move to a vault) before prod.
      await db.execute(
        `CREATE TABLE IF NOT EXISTS authors (
          user_id        TEXT PRIMARY KEY,
          email          TEXT,
          display_name   TEXT NOT NULL,
          type           TEXT NOT NULL,
          business_name  TEXT,
          intro          TEXT,
          avatar_key     TEXT,
          status         TEXT NOT NULL,
          applied_at     BIGINT NOT NULL,
          reviewed_at    BIGINT,
          reject_reason  TEXT,
          consent_pii    INTEGER NOT NULL DEFAULT 0,
          rrn            TEXT,
          biz_no         TEXT,
          bank_name      TEXT,
          bank_account   TEXT,
          account_holder TEXT
        )`,
      );
      for (const ddl of [
        `ADD COLUMN IF NOT EXISTS consent_pii INTEGER NOT NULL DEFAULT 0`,
        `ADD COLUMN IF NOT EXISTS rrn TEXT`,
        `ADD COLUMN IF NOT EXISTS biz_no TEXT`,
        `ADD COLUMN IF NOT EXISTS bank_name TEXT`,
        `ADD COLUMN IF NOT EXISTS bank_account TEXT`,
        `ADD COLUMN IF NOT EXISTS account_holder TEXT`,
        `ADD COLUMN IF NOT EXISTS avatar_key TEXT`,
        // Revenue share: percent (0–100) of this author's earnings paid to the
        // author; the platform keeps the rest. Default 80 (author-favourable).
        `ADD COLUMN IF NOT EXISTS revenue_share INTEGER NOT NULL DEFAULT 80`,
      ]) {
        await db.execute(`ALTER TABLE authors ${ddl}`);
      }

      // Likes — one row per (book, user). Count = rows for a book.
      await db.execute(
        `CREATE TABLE IF NOT EXISTS likes (
          book_id    TEXT NOT NULL,
          user_id    TEXT NOT NULL,
          created_at BIGINT NOT NULL,
          PRIMARY KEY (book_id, user_id)
        )`,
      );
      // Comments on a book.
      await db.execute(
        `CREATE TABLE IF NOT EXISTS comments (
          id         TEXT PRIMARY KEY,
          book_id    TEXT NOT NULL,
          user_id    TEXT NOT NULL,
          user_name  TEXT NOT NULL,
          body       TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )`,
      );
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_comments_book ON comments (book_id)`,
      );
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_likes_book ON likes (book_id)`,
      );

      // Reads — one row per (book, user, month). The PK dedupes so one reader
      // re-reading a book within a month counts once, which is what the monthly
      // author settlement (read-share of the subscription pool) divides by.
      await db.execute(
        `CREATE TABLE IF NOT EXISTS reads (
          book_id    TEXT NOT NULL,
          user_id    TEXT NOT NULL,
          period     TEXT NOT NULL,
          created_at BIGINT NOT NULL,
          PRIMARY KEY (book_id, user_id, period)
        )`,
      );
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_reads_period ON reads (period)`,
      );

      // Shared background-music pool — authors upload MP3s here; a random one
      // plays when a book without its own music is opened. `key` is the R2 key.
      await db.execute(
        `CREATE TABLE IF NOT EXISTS bgm_tracks (
          id         TEXT PRIMARY KEY,
          name       TEXT NOT NULL,
          key        TEXT NOT NULL,
          owner_id   TEXT NOT NULL,
          owner_name TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )`,
      );
    })();
  }
  return schemaReady;
}
