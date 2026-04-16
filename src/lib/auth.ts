import { NextRequest, NextResponse } from "next/server";

/**
 * Verify the x-cron-secret header for cron endpoints.
 * Returns a 401 response if invalid, or null if valid.
 */
export function verifyCronSecret(request: NextRequest): NextResponse | null {
  const cronSecret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  if (!expected || cronSecret !== expected) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } },
      { status: 401 }
    );
  }

  return null;
}

/**
 * Sanitize error messages for API responses.
 * In production, returns a generic message. In development, returns the full error.
 */
export function safeErrorMessage(error: unknown, fallback: string): string {
  if (process.env.NODE_ENV === "development") {
    return error instanceof Error ? error.message : fallback;
  }
  return fallback;
}
