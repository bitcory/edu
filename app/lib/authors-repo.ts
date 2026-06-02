import { db, ensureSchema, type Row } from "./db";
import type {
  Author,
  AuthorApplyInput,
  AuthorStatus,
  AuthorType,
} from "./author-types";

/** Server-side data access for author profiles. Do NOT import from client. */

function rowToAuthor(row: Row): Author {
  return {
    userId: String(row.user_id),
    email: row.email == null ? null : String(row.email),
    displayName: String(row.display_name),
    type: String(row.type) as AuthorType,
    businessName:
      row.business_name == null ? undefined : String(row.business_name),
    intro: row.intro == null ? undefined : String(row.intro),
    status: String(row.status) as AuthorStatus,
    appliedAt: Number(row.applied_at),
    reviewedAt: row.reviewed_at == null ? undefined : Number(row.reviewed_at),
    rejectReason:
      row.reject_reason == null ? undefined : String(row.reject_reason),
    consentPII: Number(row.consent_pii ?? 0) === 1,
    rrn: row.rrn == null ? undefined : String(row.rrn),
    bizNo: row.biz_no == null ? undefined : String(row.biz_no),
    bankName: row.bank_name == null ? undefined : String(row.bank_name),
    bankAccount:
      row.bank_account == null ? undefined : String(row.bank_account),
    accountHolder:
      row.account_holder == null ? undefined : String(row.account_holder),
  };
}

export async function getAuthor(userId: string): Promise<Author | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT * FROM authors WHERE user_id = ?`,
    args: [userId],
  });
  const row = res.rows[0];
  return row ? rowToAuthor(row) : null;
}

/** Public profile (PII-free) for an APPROVED author — null otherwise. Safe to
 *  return to anyone; never selects payout/PII columns. */
export async function getPublicAuthor(
  userId: string,
): Promise<import("./author-types").PublicAuthor | null> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT user_id, display_name, type, business_name, intro
          FROM authors WHERE user_id = ? AND status = 'approved'`,
    args: [userId],
  });
  const row = res.rows[0];
  if (!row) return null;
  return {
    userId: String(row.user_id),
    displayName: String(row.display_name),
    type: String(row.type) as AuthorType,
    businessName:
      row.business_name == null ? undefined : String(row.business_name),
    intro: row.intro == null ? undefined : String(row.intro),
  };
}

/** Directory of all APPROVED authors (PII-free) with aggregates over their
 *  approved books, most-liked authors first. For the "작가 선택" picker. */
export async function listPublicAuthors(): Promise<
  import("./author-types").AuthorCard[]
> {
  await ensureSchema();
  const res = await db.execute({
    sql: `SELECT a.user_id, a.display_name, a.intro,
            (SELECT COUNT(*) FROM books b
               WHERE b.owner_id = a.user_id AND b.status = 'approved') AS book_count,
            (SELECT COUNT(*) FROM likes l JOIN books b ON l.book_id = b.id
               WHERE b.owner_id = a.user_id AND b.status = 'approved') AS total_likes
          FROM authors a
          WHERE a.status = 'approved'
          ORDER BY total_likes DESC, book_count DESC, a.display_name ASC`,
    args: [],
  });
  return res.rows.map((row) => ({
    userId: String(row.user_id),
    displayName: String(row.display_name),
    intro: row.intro == null ? undefined : String(row.intro),
    bookCount: Number(row.book_count ?? 0),
    totalLikes: Number(row.total_likes ?? 0),
  }));
}

export async function isApprovedAuthor(userId: string): Promise<boolean> {
  const a = await getAuthor(userId);
  return a?.status === "approved";
}

/** Create or re-submit an application. Re-applying resets status to pending. */
export async function applyAuthor(
  userId: string,
  email: string | null,
  input: AuthorApplyInput,
): Promise<Author> {
  await ensureSchema();
  const consent = input.consentPII === true;
  // Only keep sensitive fields when consent was given.
  const rrn = consent && input.type === "individual" ? input.rrn?.trim() : "";
  const bizNo = consent && input.type === "business" ? input.bizNo?.trim() : "";
  const bankName = consent ? input.bankName?.trim() : "";
  const bankAccount = consent ? input.bankAccount?.trim() : "";
  const accountHolder = consent ? input.accountHolder?.trim() : "";

  const author: Author = {
    userId,
    email,
    displayName: input.displayName.trim() || "작가",
    type: input.type,
    businessName:
      input.type === "business"
        ? input.businessName?.trim() || undefined
        : undefined,
    intro: input.intro?.trim() || undefined,
    status: "pending",
    appliedAt: Date.now(),
    consentPII: consent,
    rrn: rrn || undefined,
    bizNo: bizNo || undefined,
    bankName: bankName || undefined,
    bankAccount: bankAccount || undefined,
    accountHolder: accountHolder || undefined,
  };
  await db.execute({
    sql: `INSERT INTO authors
            (user_id, email, display_name, type, business_name, intro, status, applied_at, reviewed_at, reject_reason,
             consent_pii, rrn, biz_no, bank_name, bank_account, account_holder)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NULL, NULL, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            email = excluded.email,
            display_name = excluded.display_name,
            type = excluded.type,
            business_name = excluded.business_name,
            intro = excluded.intro,
            status = 'pending',
            applied_at = excluded.applied_at,
            reviewed_at = NULL,
            reject_reason = NULL,
            consent_pii = excluded.consent_pii,
            rrn = excluded.rrn,
            biz_no = excluded.biz_no,
            bank_name = excluded.bank_name,
            bank_account = excluded.bank_account,
            account_holder = excluded.account_holder`,
    args: [
      author.userId,
      author.email,
      author.displayName,
      author.type,
      author.businessName ?? null,
      author.intro ?? null,
      author.appliedAt,
      consent ? 1 : 0,
      author.rrn ?? null,
      author.bizNo ?? null,
      author.bankName ?? null,
      author.bankAccount ?? null,
      author.accountHolder ?? null,
    ],
  });
  return author;
}

export async function listAuthors(
  status: AuthorStatus,
): Promise<Author[]> {
  await ensureSchema();
  const order =
    status === "pending"
      ? "applied_at ASC"
      : "COALESCE(reviewed_at, applied_at) DESC";
  const res = await db.execute({
    sql: `SELECT * FROM authors WHERE status = ? ORDER BY ${order}`,
    args: [status],
  });
  return res.rows.map(rowToAuthor);
}

export async function listPendingAuthors(): Promise<Author[]> {
  return listAuthors("pending");
}

/** Ensure the user has an approved author record (used for admins, who are
 * authors by default). Keeps existing profile fields; just forces approval. */
export async function ensureApprovedAuthor(
  userId: string,
  email: string | null,
  name: string,
): Promise<Author> {
  await ensureSchema();
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO authors
            (user_id, email, display_name, type, status, applied_at, reviewed_at, consent_pii)
          VALUES (?, ?, ?, 'individual', 'approved', ?, ?, 0)
          ON CONFLICT(user_id) DO UPDATE SET
            status = 'approved',
            reviewed_at = excluded.reviewed_at,
            reject_reason = NULL,
            email = excluded.email`,
    args: [userId, email, name || "관리자", now, now],
  });
  return (await getAuthor(userId))!;
}

export async function setAuthorStatus(
  userId: string,
  status: Exclude<AuthorStatus, "pending">,
  rejectReason?: string,
): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: `UPDATE authors SET status = ?, reviewed_at = ?, reject_reason = ? WHERE user_id = ?`,
    args: [status, Date.now(), rejectReason?.trim() || null, userId],
  });
}
