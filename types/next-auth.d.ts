import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** 로그인 아이디 (users.username). */
      username: string;
      /** users.is_admin 또는 ADMIN_USERNAMES 로 부여된 관리자 여부. */
      isAdmin: boolean;
    } & DefaultSession["user"];
  }

  /** Credentials.authorize 가 돌려주는 값 — jwt 콜백의 `user` 로 들어온다. */
  interface User {
    username?: string;
    isAdmin?: boolean;
  }
}

// JWT 는 증강하지 않는다 — 실제 인터페이스는 @auth/core/jwt 에 있어서
// "next-auth/jwt" 를 declare module 해도 콜백 타입에 반영되지 않는다.
// auth.ts 의 session 콜백이 token 값을 직접 좁혀서 쓴다.
