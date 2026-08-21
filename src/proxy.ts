import type {
  NextRequest,
} from "next/server";

import {
  NextResponse,
} from "next/server";

import {
  verifyToken,
} from "@/lib/auth";

import {
  AUTH_COOKIE_NAME,
  getExpiredAuthCookieOptions,
} from "@/lib/auth-cookie";

const LOGIN_PATH =
  "/login";

const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/orders",
  "/billing",
  "/categories",
  "/menu",
  "/addons",
  "/variations",
  "/inventory",
  "/recipes",
  "/wastage",
  "/analytics",
  "/reports",
  "/audit-logs",
  "/users",
  "/settings",
  "/data-exports",
] as const;

function matchesRoutePrefix(
  pathname: string,
  prefix: string,
): boolean {
  return (
    pathname === prefix ||
    pathname.startsWith(
      `${prefix}/`,
    )
  );
}

function isProtectedRoute(
  pathname: string,
): boolean {
  /*
   * The POS shell itself is deliberately cacheable/public
   * so the PWA can open it without a server request. The
   * actual data and every mutation remain protected by the
   * authenticated API routes and the local offline lease.
   */
  if (matchesRoutePrefix(pathname, "/orders/new")) {
    return false;
  }

  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) =>
      matchesRoutePrefix(
        pathname,
        prefix,
      ),
  );
}

function createLoginRedirect(
  request: NextRequest,
): NextResponse {
  const url =
    request.nextUrl.clone();

  url.pathname =
    LOGIN_PATH;

  url.search =
    "";

  const response =
    NextResponse.redirect(
      url,
    );

  response.headers.set(
    "Cache-Control",
    "no-store, max-age=0",
  );

  return response;
}

function expireAuthCookie(
  response: NextResponse,
): void {
  response.cookies.set(
    AUTH_COOKIE_NAME,
    "",
    getExpiredAuthCookieOptions(),
  );
}

function cleanCredentialQuery(
  request: NextRequest,
): NextResponse | null {
  if (
    request.nextUrl.pathname !==
    LOGIN_PATH
  ) {
    return null;
  }

  const hasCredentialQuery =
    request.nextUrl.searchParams.has(
      "password",
    ) ||
    request.nextUrl.searchParams.has(
      "email",
    );

  if (!hasCredentialQuery) {
    return null;
  }

  const cleanUrl =
    request.nextUrl.clone();

  cleanUrl.search =
    "";

  return NextResponse.redirect(
    cleanUrl,
  );
}

export function proxy(
  request: NextRequest,
): NextResponse {
  const cleanRedirect =
    cleanCredentialQuery(
      request,
    );

  if (cleanRedirect) {
    return cleanRedirect;
  }

  const pathname =
    request.nextUrl.pathname;

  const protectedRoute =
    isProtectedRoute(
      pathname,
    );

  const token =
    request.cookies.get(
      AUTH_COOKIE_NAME,
    )?.value;

  if (!token) {
    if (protectedRoute) {
      return createLoginRedirect(
        request,
      );
    }

    return NextResponse.next();
  }

  const authenticatedUser =
    verifyToken(
      token,
    );

  if (!authenticatedUser) {
    if (protectedRoute) {
      const response =
        createLoginRedirect(
          request,
        );

      expireAuthCookie(
        response,
      );

      return response;
    }

    const response =
      NextResponse.next();

    expireAuthCookie(
      response,
    );

    return response;
  }

  /*
   * Do not redirect /login to /dashboard here.
   * A valid JWT may belong to a deleted or
   * deactivated database user.
   */
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};