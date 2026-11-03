import { NextResponse } from "next/server";

/**
 * Optimistic redirect only: unauthenticated visitors are sent to /login before the page renders.
 * Real authorization happens on the server for every page and API call — never rely on this file.
 */
const PROTECTED = ["/dashboard", "/workspaces", "/projects", "/studio", "/team", "/settings"];
export function proxy(request) {
  const { pathname } = request.nextUrl;
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/")) && !request.cookies.get("f2c_session")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!api|_next|preview-vendor|favicon.ico).*)"] };
