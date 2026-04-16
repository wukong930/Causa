import { NextRequest, NextResponse } from "next/server";

/**
 * Global API authentication middleware.
 * - /api/cron/* routes require x-cron-secret header
 * - All other /api/* routes require Authorization: Bearer <API_SECRET>
 * - Non-API routes pass through
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /api/* routes
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Cron routes: validated inside each handler via verifyCronSecret()
  // Still require Bearer token at middleware level
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.API_SECRET;

  // If API_SECRET is not configured, skip auth (development mode)
  if (!expectedSecret) {
    return NextResponse.next();
  }

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
