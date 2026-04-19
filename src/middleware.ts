import { NextRequest, NextResponse } from "next/server";

/**
 * Global API authentication middleware.
 * - Same-origin requests (from the Next.js frontend) pass through
 * - External /api/* requests require Authorization: Bearer <API_SECRET>
 * - /api/cron/* routes additionally validated inside each handler via verifyCronSecret()
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /api/* routes
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Health endpoint is public (Docker healthcheck)
  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  const expectedSecret = process.env.API_SECRET;

  // If API_SECRET is not configured, skip auth (development mode)
  if (!expectedSecret) {
    return NextResponse.next();
  }

  // Allow same-origin requests from the Next.js frontend
  const referer = request.headers.get("referer");
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (host) {
    try {
      const refererHost = referer ? new URL(referer).host : null;
      const originHost = origin ? new URL(origin).host : null;
      if (refererHost === host || originHost === host) {
        return NextResponse.next();
      }
    } catch {
      // Malformed URL — fall through to Bearer check
    }
  }

  // External requests require Bearer token
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token !== expectedSecret) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing API token" } },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
