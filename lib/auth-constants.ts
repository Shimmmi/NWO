export const SESSION_COOKIE = "session";
export const COOKIE_PATH = "/nwo";

export interface SessionPayload {
  userId: string;
  email: string;
  nickname: string;
  /** Unix-миллисекунды истечения: сокет следит за ним по ходу матча. */
  exp: number;
}
