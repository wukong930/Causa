import { NextRequest } from "next/server";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { gt, eq, and, desc } from "drizzle-orm";
import type { Alert } from "@/types/domain";
import { serializeRecord } from "@/lib/serialize";

// GET /api/alerts/stream - SSE endpoint for real-time alert updates
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sinceParam = searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 60 * 60 * 1000);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`)
      );

      // Poll for new alerts every 10 seconds
      const poll = async () => {
        try {
          const newAlerts = await db
            .select()
            .from(alerts)
            .where(gt(alerts.triggeredAt, since))
            .orderBy(desc(alerts.triggeredAt))
            .limit(50);

          if (newAlerts.length > 0) {
            const serialized = newAlerts.map((a) => serializeRecord<Alert>(a));
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "alerts", alerts: serialized, count: newAlerts.length })}\n\n`
              )
            );
            // Update since to the latest alert timestamp
            if (newAlerts[0]) {
              since.setTime(newAlerts[0].triggeredAt.getTime());
            }
          }

          // Send heartbeat
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "heartbeat", timestamp: new Date().toISOString() })}\n\n`)
          );
        } catch (err) {
          console.error("SSE poll error:", err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message: "Poll failed" })}\n\n`)
          );
        }
      };

      // Initial poll
      await poll();

      // Poll every 10 seconds
      const interval = setInterval(() => {
        poll().catch((err) => console.error("SSE poll unhandled:", err));
      }, 10000);

      // Clean up when client disconnects
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
