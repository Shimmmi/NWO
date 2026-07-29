import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";

const PROTECTED = ["/game", "/decks", "/characters", "/profile", "/join"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!PROTECTED.some((p) => pathname.startsWith(p))) return NextResponse.next();

  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  // Назначение сохраняется: ссылка-инвайт, открытая без входа, после
  // авторизации обязана вернуть игрока в лобби, а не на главную.
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/auth";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
