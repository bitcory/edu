import { createUser } from "../../lib/users-repo";

/**
 * 회원가입. 로그아웃 상태에서 호출되므로 auth.ts 의 isPublicPath 에 열려 있다.
 * 계정 생성만 하고 로그인은 하지 않는다 — 클라이언트가 이어서 signIn 을 부른다.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const { username, password, displayName } = (body ?? {}) as Record<
    string,
    unknown
  >;
  if (typeof username !== "string" || typeof password !== "string") {
    return Response.json(
      { error: "아이디와 비밀번호를 입력해 주세요." },
      { status: 400 },
    );
  }

  const result = await createUser(
    username,
    password,
    typeof displayName === "string" ? displayName : "",
  );
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 409 });
  }
  return Response.json({ ok: true, username: result.user.username });
}
