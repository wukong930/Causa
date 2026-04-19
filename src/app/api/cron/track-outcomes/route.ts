import { NextResponse } from "next/server";
import { trackOutcomes } from "@/lib/tracking/outcome-tracker";

export async function POST() {
  try {
    const results = await trackOutcomes();
    const wins = results.filter((r) => r.outcome === "win").length;
    const losses = results.filter((r) => r.outcome === "loss").length;
    const open = results.filter((r) => r.outcome === "open").length;
    const expired = results.filter((r) => r.outcome === "expired").length;

    return NextResponse.json({
      success: true,
      tracked: results.length,
      summary: { wins, losses, open, expired },
      winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null,
    });
  } catch (error) {
    console.error("[cron/track-outcomes] Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
