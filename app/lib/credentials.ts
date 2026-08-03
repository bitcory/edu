import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * 외부 AI 자격증명 보관소 — Vertex AI 서비스 계정 JSON, Google AI Studio API 키.
 *
 * 환경변수가 아니라 파일로 두는 이유: 관리자가 화면에서 올리고 바꿀 수 있어야
 * 하는데, 환경변수는 프로세스를 다시 띄워야 반영되기 때문이다.
 *
 * 보관 위치는 SECRETS_DIR — **STORAGE_DIR 바깥**이다. /api/files 는 STORAGE_DIR
 * 아래만 서빙하므로, 설령 키 검사에 구멍이 나도 자격증명 파일에는 닿을 수 없다.
 * 리포 바깥이기도 해서 커밋될 일도 없다.
 *
 * 서버 전용. 클라이언트 컴포넌트에서 import 하지 말 것. 이 모듈의 조회 함수는
 * 비밀값 자체를 절대 응답으로 내보내지 않는다 — status() 는 마스킹된 요약만 준다.
 */

const VERTEX_FILE = "vertex-service-account.json";
const AI_STUDIO_FILE = "ai-studio.json";

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
    | { configured: false; source: null }
    | {
        configured: true;
        source: "file" | "env";
        projectId: string;
        clientEmail: string;
        updatedAt: number | null;
      };
  aiStudio:
    | { configured: false; source: null }
    | {
        configured: true;
        source: "file" | "env";
        /** 앞뒤 몇 글자만 남긴 값 — 어떤 키가 들어있는지 식별만 가능하게. */
        masked: string;
        updatedAt: number | null;
      };
};

function secretsDir(): string {
  const dir = process.env.SECRETS_DIR;
  if (!dir) {
    throw new Error(
      "SECRETS_DIR is not set. Point it at a directory outside the repo and outside STORAGE_DIR.",
    );
  }
  return dir;
}

async function secretPath(file: string): Promise<string> {
  const dir = secretsDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  // 상위 디렉터리가 이미 있었다면 mkdir 의 mode 는 적용되지 않는다 — 명시적으로 조인다.
  await chmod(dir, 0o700).catch(() => {});
  return path.join(dir, file);
}

async function readJson<T>(file: string): Promise<{ value: T; mtime: number } | null> {
  try {
    const p = await secretPath(file);
    const [raw, s] = await Promise.all([readFile(p, "utf8"), stat(p)]);
    return { value: JSON.parse(raw) as T, mtime: s.mtimeMs };
  } catch {
    return null;
  }
}

async function writeSecret(file: string, contents: string): Promise<void> {
  const p = await secretPath(file);
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

/** 저장된 서비스 계정. 파일이 없으면 GOOGLE_APPLICATION_CREDENTIALS 로 폴백한다
 * (헤드리스 셋업용). 둘 다 없으면 null. */
export async function readVertexServiceAccount(): Promise<VertexServiceAccount | null> {
  const fromFile = await readJson<VertexServiceAccount>(VERTEX_FILE);
  if (fromFile) {
    const v = validateServiceAccount(fromFile.value);
    return v.ok ? v.value : null;
  }
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!envPath) return null;
  try {
    const raw = await readFile(envPath, "utf8");
    const v = validateServiceAccount(JSON.parse(raw));
    return v.ok ? v.value : null;
  } catch {
    return null;
  }
}

export async function saveVertexServiceAccount(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = validateServiceAccount(input);
  if (!v.ok) return v;
  await writeSecret(VERTEX_FILE, JSON.stringify(v.value));
  return { ok: true };
}

export async function clearVertexServiceAccount(): Promise<void> {
  const p = await secretPath(VERTEX_FILE);
  await rm(p, { force: true });
}

/* ------------------------------------------------------------------ *
 * Google AI Studio — API 키
 * ------------------------------------------------------------------ */

export async function readAiStudioKey(): Promise<string | null> {
  const fromFile = await readJson<{ apiKey?: string }>(AI_STUDIO_FILE);
  const key = fromFile?.value?.apiKey?.trim();
  if (key) return key;
  return process.env.GOOGLE_AI_STUDIO_API_KEY?.trim() || null;
}

export async function saveAiStudioKey(
  key: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = key.trim();
  if (!trimmed) return { ok: false, error: "키가 비어 있어요." };
  // 실제 키는 40자 안팎의 URL-safe 문자열이다. 앞뒤 공백이나 "AIza..." 아닌
  // 값을 그대로 저장해 두면 호출 시점에야 실패하므로 여기서 거른다.
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(trimmed)) {
    return {
      ok: false,
      error: "키 형식이 올바르지 않아요. 공백이나 따옴표가 섞이지 않았는지 확인해 주세요.",
    };
  }
  await writeSecret(AI_STUDIO_FILE, JSON.stringify({ apiKey: trimmed }));
  return { ok: true };
}

export async function clearAiStudioKey(): Promise<void> {
  const p = await secretPath(AI_STUDIO_FILE);
  await rm(p, { force: true });
}

/* ------------------------------------------------------------------ *
 * 상태 — 화면에 보여줄 요약. 비밀값은 절대 나가지 않는다.
 * ------------------------------------------------------------------ */

function mask(key: string): string {
  if (key.length <= 10) return "•".repeat(key.length);
  return `${key.slice(0, 4)}${"•".repeat(12)}${key.slice(-4)}`;
}

export async function credentialStatus(): Promise<CredentialStatus> {
  const vertexFile = await readJson<VertexServiceAccount>(VERTEX_FILE);
  const aiFile = await readJson<{ apiKey?: string }>(AI_STUDIO_FILE);

  let vertex: CredentialStatus["vertex"] = { configured: false, source: null };
  if (vertexFile) {
    const v = validateServiceAccount(vertexFile.value);
    if (v.ok) {
      vertex = {
        configured: true,
        source: "file",
        projectId: v.value.project_id,
        clientEmail: v.value.client_email,
        updatedAt: vertexFile.mtime,
      };
    }
  } else {
    const fromEnv = await readVertexServiceAccount();
    if (fromEnv) {
      vertex = {
        configured: true,
        source: "env",
        projectId: fromEnv.project_id,
        clientEmail: fromEnv.client_email,
        updatedAt: null,
      };
    }
  }

  let aiStudio: CredentialStatus["aiStudio"] = { configured: false, source: null };
  const fileKey = aiFile?.value?.apiKey?.trim();
  if (fileKey) {
    aiStudio = {
      configured: true,
      source: "file",
      masked: mask(fileKey),
      updatedAt: aiFile?.mtime ?? null,
    };
  } else {
    const envKey = process.env.GOOGLE_AI_STUDIO_API_KEY?.trim();
    if (envKey) {
      aiStudio = {
        configured: true,
        source: "env",
        masked: mask(envKey),
        updatedAt: null,
      };
    }
  }

  return { vertex, aiStudio };
}
