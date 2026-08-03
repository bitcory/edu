import { randomUUID, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db, ensureSchema } from "./db";

/**
 * Local accounts: 아이디 + 비밀번호. There is no external identity provider —
 * this server is self-hosted and the audience is 영유아 보호자·교사, for whom a
 * Google account is an extra hurdle rather than a convenience.
 *
 * Passwords are hashed with scrypt from node:crypto (no third-party dep). The
 * stored format is `scrypt$N$r$p$<salt-b64>$<hash-b64>` so the cost parameters
 * travel with the hash and can be raised later without invalidating old rows.
 */

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// 128 * N * r bytes of memory — 32MB at these settings, so maxmem is raised
// above Node's 32MB default or scrypt throws.
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };
const KEYLEN = 64;

export type User = {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: number;
};

export const USERNAME_RE = /^[a-z0-9][a-z0-9_]{3,19}$/;
export const MIN_PASSWORD_LENGTH = 8;

/** Human-readable rule violations, or null when the input is acceptable. */
export function validateCredentials(
  username: string,
  password: string,
): string | null {
  if (!USERNAME_RE.test(username)) {
    return "아이디는 영문 소문자·숫자·밑줄 4~20자이고, 첫 글자는 영문 또는 숫자여야 해요.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.`;
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEYLEN, PARAMS);
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  let actual: Buffer;
  try {
    actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: PARAMS.maxmem,
    });
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Usernames listed here are admins regardless of the DB flag — lets the very
 * first admin exist before anyone can grant the flag. */
function envAdmins(): string[] {
  return (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function toUser(row: Record<string, unknown>): User {
  const username = String(row.username);
  return {
    id: String(row.user_id),
    username,
    displayName: String(row.display_name),
    isAdmin: Number(row.is_admin) === 1 || envAdmins().includes(username),
    createdAt: Number(row.created_at),
  };
}

/** 세션 토큰의 권한을 매 요청 갱신하는 데 쓴다 — auth.ts 의 jwt 콜백 참조. */
export async function findUserById(userId: string): Promise<User | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT user_id, username, display_name, is_admin, created_at FROM users WHERE user_id = ?",
    args: [userId],
  });
  return res.rows[0] ? toUser(res.rows[0]) : null;
}

export async function findUserByUsername(username: string): Promise<User | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT user_id, username, display_name, is_admin, created_at FROM users WHERE username = ?",
    args: [username.toLowerCase()],
  });
  return res.rows[0] ? toUser(res.rows[0]) : null;
}

/** Create an account. Returns an error message on conflict/invalid input. */
export async function createUser(
  username: string,
  password: string,
  displayName: string,
): Promise<{ user: User } | { error: string }> {
  await ensureSchema();
  const uname = username.trim().toLowerCase();
  const invalid = validateCredentials(uname, password);
  if (invalid) return { error: invalid };

  const name = displayName.trim() || uname;
  const id = randomUUID();
  const now = Date.now();
  const hash = await hashPassword(password);

  // ON CONFLICT DO NOTHING → 0 rows means the username was taken. Checking
  // first would race two simultaneous signups onto the same username.
  const res = await db.execute({
    sql: `INSERT INTO users (user_id, username, password_hash, display_name, is_admin, created_at)
          VALUES (?, ?, ?, ?, 0, ?)
          ON CONFLICT (username) DO NOTHING
          RETURNING user_id, username, display_name, is_admin, created_at`,
    args: [id, uname, hash, name, now],
  });
  if (!res.rows[0]) return { error: "이미 사용 중인 아이디예요." };
  return { user: toUser(res.rows[0]) };
}

/** Verify 아이디/비밀번호. Returns null on any failure — never says which part
 * was wrong, so the response can't be used to enumerate usernames. */
export async function verifyUser(
  username: string,
  password: string,
): Promise<User | null> {
  await ensureSchema();
  const uname = username.trim().toLowerCase();
  const res = await db.execute({
    sql: "SELECT user_id, username, password_hash, display_name, is_admin, created_at FROM users WHERE username = ?",
    args: [uname],
  });
  const row = res.rows[0];
  if (!row) {
    // Spend comparable time on a missing user so timing doesn't reveal
    // whether the username exists.
    await hashPassword(password);
    return null;
  }
  const ok = await verifyPassword(password, String(row.password_hash));
  return ok ? toUser(row) : null;
}
