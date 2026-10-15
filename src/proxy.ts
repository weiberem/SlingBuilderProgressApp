import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistischer Cookie-Check (Next 16: `proxy` statt `middleware`). Die echte Prüfung der Session
 * passiert in der Datenzugriffsschicht (`requireUser`). Hier nur Umleitung auf /login.
 */
const PUBLIC_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/verify-email", "/offline"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const hasSession = request.cookies.has("sbt_session");
  if (!isPublic && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
