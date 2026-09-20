import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("auth_session");

  const isProtectedRoute =
    pathname.startsWith("/tools") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/disputes");
  const isAuthRoute = pathname === "/login";
  const isRoot = pathname === "/";

  // Redirect root path depending on session
  if (isRoot) {
    if (hasSession) {
      return NextResponse.redirect(new URL("/tools", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect unauthenticated requests to login
  if (isProtectedRoute && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated requests away from login page to dashboard
  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL("/tools", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
