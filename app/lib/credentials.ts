import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * 외부 AI 자격증명 보관소 — Vertex AI 서비스 계정 JSON, Google AI Studio API 키.
 *
 * **자격증명은 사용자별이다.** 각자 자기 GCP 크레딧·자기 할당량으로 생성하므로
 * 한 사람의 키가 다른 사람에게 보이거나 쓰여서는 안 된다. 관리자가 올리는
 * 서버 기본값은 개인 키가 없을 때만 쓰이는 폴백이다.
 *
 *   SECRETS_DIR/
 *     server/            ← 관리자가 올린 기본값 (폴백)
 *     users/<userId>/    ← 각 사용자의 키
 *
 * 환경변수가 아니라 파일로 두는 이유: 화면에서 올리고 바꿀 수 있어야 하는데
 * 환경변수는 프로세스를 다시 띄워야 반영되기 때문이다.
 *
 * SECRETS_DIR 는 **STORAGE_DIR 바깥**이다. /api/files 는 STORAGE_DIR 아래만
 * 서빙하므로, 설령 키 검사에 구멍이 나도 자격증명 파일에는 닿을 수 없다.
 *
 * 서버 전용. 클라이언트 컴포넌트에서 import 하지 말 것. 조회 함수는 비밀값을
 * 응답으로 내보내지 않는다 — status() 는 마스킹된 요약만 준다.
 */

const VERTEX_FILE = "vertex-service-account.json";
const AI_STUDIO_FILE = "ai-studio.json";

/** 누구의 자격증명인지. userId 는 users.user_id (UUID). */
export type Scope = { kind: "server" } | { kind: "user"; userId: string };

export const SERVER_SCOPE: Scope = { kind: "server" };
export const userScope = (userId: string): Scope => ({ kind: "user", userId });

export type VertexServiceAccount = {
  type: string;
  project_id: string;
  client_email: string;
  private_key: string;
  private_key_id?: string;
  token_uri?: string;
};

export type CredentialStatus = {
  vertex:
    | { configured: false }
    | {
        configured: true;
        projectId: string;
        clientEmail: string;
        updatedAt: number | null;
      };
  aiStudio:
    | { configured: false }
    | {
        configured: true;
        /** 앞뒤 몇 글자만 남긴 값 — 어떤 키가 들어있는지 식별만 가능하게. */
        masked: string;
        updatedAt: number | null;
      };
};

/** 개인 키가 없어 서버 기본값으로 동작하는지까지 알려 준다. */
export type EffectiveStatus = CredentialStatus & {
  vertexSource: "user" | "server" | null;
  aiStudioSource: "user" | "server" | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secretsRoot(): string {
  const dir = process.env.SECRETS_DIR;
  if (!dir) {
    throw new Error(
      "SECRETS_DIR is not set. Point it at a directory outside the repo and outside STORAGE_DIR.",
    );
  }
  return dir;
}

/** scope → 디렉터리. userId 는 UUID 형태만 허용한다 — 세션에서 온 값이라도
 * 경로에 그대로 쓰는 이상 형식을 확인하고 넣는다. */
function scopeDir(scope: Scope): string {
  const root = secretsRoot();
  if (scope.kind === "server") return path.join(root, "server");
  if (!UUID_RE.test(scope.userId)) {
    throw new Error("invalid user id for credential scope");
  }
  return path.join(root, "users", scope.userId);
}

async function secretPath(scope: Scope, file: string): Promise<string> {
  const dir = scopeDir(scope);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  // 이미 있던 디렉터리에는 mkdir 의 mode 가 적용되지 않는다 — 명시적으로 조인다.
  await chmod(dir, 0o700).catch(() => {});
  await chmod(secretsRoot(), 0o700).catch(() => {});
  return path.join(dir, file);
}

async function readJson<T>(
  scope: Scope,
  file: string,
): Promise<{ value: T; mtime: number } | null> {
  try {
    const p = path.join(scopeDir(scope), file);
    const [raw, s] = await Promise.all([readFile(p, "utf8"), stat(p)]);
    return { value: JSON.parse(raw) as T, mtime: s.mtimeMs };
  } catch {
    return null;
  }
}

async function writeSecret(
  scope: Scope,
  file: string,
  contents: string,
): Promise<void> {
  const p = await secretPath(scope, file);
  await writeFile(p, contents, { encoding: "utf8", mode: 0o600 });
  // 파일이 이미 있었다면 writeFile 의 mode 가 무시된다 — 여기서도 명시적으로.
  await chmod(p, 0o600);
}

/* ------------------------------------------------------------------ *
 * Vertex AI — 서비스 계정 JSON
 * ------------------------------------------------------------------ */

/** 업로드된 JSON 이 실제로 서비스 계정 키인지 확인한다. 잘못된 파일을 저장해
 * 두면 생성 시점에야 알 수 있어서, 받는 자리에서 거른다. */
export function validateServiceAccount(
  input: unknown,
): { ok: true; value: VertexServiceAccount } | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "JSON 형식이 아니에요." };
  }
  const o = input as Record<string, unknown>;
  if (o.type !== "service_account") {
    return {
      ok: false,
      error:
        '서비스 계정 키가 아니에요. type 이 "service_account" 인 JSON 을 올려 주세요. (OAuth 클라이언트 JSON 은 다른 파일입니다.)',
    };
  }
  for (const field of ["project_id", "client_email", "private_key"] as const) {
    if (typeof o[field] !== "string" || !o[field]) {
      return { ok: false, error: `필수 항목이 없어요: ${field}` };
    }
  }
  if (!String(o.private_key).includes("BEGIN PRIVATE KEY")) {
    return { ok: false, error: "private_key 가 올바른 형식이 아니에요." };
  }
  return { ok: true, value: input as VertexServiceAccount };
}

async function readVertexAt(scope: Scope): Promise<VertexServiceAccount | null> {
  const stored = await readJson<VertexServiceAccount>(scope, VERTEX_FILE);
  if (!stored) return null;
  const v = validateServiceAccount(stored.value);
  return v.ok ? v.value : null;
}

export async function saveVertexServiceAccount(
  scope: Scope,
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = validateServiceAccount(input);
  if (!v.ok) return v;
  await writeSecret(scope, VERTEX_FILE, JSON.stringify(v.value));
  return { ok: true };
}

export async function clearVertexServiceAccount(scope: Scope): Promise<void> {
  await rm(path.join(scopeDir(scope), VERTEX_FILE), { force: true });
}

/* ------------------------------------------------------------------ *
 * Google AI Studio — API 키
 * ------------------------------------------------------------------ */

async function readAiStudioAt(scope: Scope): Promise<string | null> {
  const stored = await readJson<{ apiKey?: string }>(scope, AI_STUDIO_FILE);
  return stored?.value?.apiKey?.trim() || null;
}

export async function saveAiStudioKey(
  scope: Scope,
  key: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = key.trim();
  if (!trimmed) return { ok: false, error: "키가 비어 있어요." };
  // 실제 키는 40자 안팎의 URL-safe 문자열이다. 공백이나 따옴표가 섞인 값을
  // 그대로 저장해 두면 호출 시점에야 실패하므로 여기서 거른다.
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(trimmed)) {
    return {
      ok: false,
      error:
        "키 형식이 올바르지 않아요. 공백이나 따옴표가 섞이지 않았는지 확인해 주세요.",
    };
  }
  await writeSecret(scope, AI_STUDIO_FILE, JSON.stringify({ apiKey: trimmed }));
  return { ok: true };
}

export async function clearAiStudioKey(scope: Scope): Promise<void> {
  await rm(path.join(scopeDir(scope), AI_STUDIO_FILE), { force: true });
}

/* ------------------------------------------------------------------ *
 * 실제 사용할 자격증명 — 개인 것 우선, 없으면 서버 기본값
 * ------------------------------------------------------------------ */

export async function resolveVertexServiceAccount(
  userId: string,
): Promise<{ account: VertexServiceAccount; source: "user" | "server" } | null> {
  const mine = await readVertexAt(userScope(userId));
  if (mine) return { account: mine, source: "user" };
  const server = await readVertexAt(SERVER_SCOPE);
  return server ? { account: server, source: "server" } : null;
}

export async function resolveAiStudioKey(
  userId: string,
): Promise<{ key: string; source: "user" | "server" } | null> {
  const mine = await readAiStudioAt(userScope(userId));
  if (mine) return { key: mine, source: "user" };
  const server = await readAiStudioAt(SERVER_SCOPE);
  return server ? { key: server, source: "server" } : null;
}

/* ------------------------------------------------------------------ *
 * 상태 — 화면에 보여줄 요약. 비밀값은 절대 나가지 않는다.
 * ------------------------------------------------------------------ */

function mask(key: string): string {
  if (key.length <= 10) return "•".repeat(key.length);
  return `${key.slice(0, 4)}${"•".repeat(12)}${key.slice(-4)}`;
}

/** 한 scope 에 무엇이 저장돼 있는지. */
export async function credentialStatus(scope: Scope): Promise<CredentialStatus> {
  const vertexFile = await readJson<VertexServiceAccount>(scope, VERTEX_FILE);
  const aiFile = await readJson<{ apiKey?: string }>(scope, AI_STUDIO_FILE);

  let vertex: CredentialStatus["vertex"] = { configured: false };
  if (vertexFile) {
    const v = validateServiceAccount(vertexFile.value);
    if (v.ok) {
      vertex = {
        configured: true,
        projectId: v.value.project_id,
        clientEmail: v.value.client_email,
        updatedAt: vertexFile.mtime,
      };
    }
  }

  let aiStudio: CredentialStatus["aiStudio"] = { configured: false };
  const key = aiFile?.value?.apiKey?.trim();
  if (key) {
    aiStudio = {
      configured: true,
      masked: mask(key),
      updatedAt: aiFile?.mtime ?? null,
    };
  }

  return { vertex, aiStudio };
}

/** 개인 화면용 — 내 키 상태와, 비어 있을 때 서버 기본값이 받쳐 주는지까지. */
export async function effectiveStatus(userId: string): Promise<EffectiveStatus> {
  const mine = await credentialStatus(userScope(userId));
  const vertex = await resolveVertexServiceAccount(userId);
  const ai = await resolveAiStudioKey(userId);
  return {
    ...mine,
    vertexSource: vertex?.source ?? null,
    aiStudioSource: ai?.source ?? null,
  };
}
