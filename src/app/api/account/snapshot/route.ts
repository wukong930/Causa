import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { accountSnapshots } from '@/db/schema';
import { positions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { ApiResponse } from '@/types/api';
import type { AccountSnapshot } from '@/types/domain';
import { serializeRecord } from '@/lib/serialize';

// GET /api/account/snapshot - Get latest account snapshot
export async function GET(request: NextRequest) {
  try {
    // Get latest snapshot
    const snapshots = await db
      .select()
      .from(accountSnapshots)
      .orderBy(desc(accountSnapshots.snapshotAt))
      .limit(1);

    let snapshot: AccountSnapshot;

    if (snapshots.length > 0) {
      snapshot = serializeRecord<AccountSnapshot>(snapshots[0]);
    } else {
      // Aggregate from positions if no snapshot exists
      const positionGroups = await db.select().from(positions);

      const totalUnrealizedPnl = positionGroups.reduce(
        (sum, p) => sum + (p.unrealizedPnl as number || 0),
        0
      );
      const totalMarginUsed = positionGroups.reduce(
        (sum, p) => sum + (p.totalMarginUsed as number || 0),
        0
      );

      // Insert computed snapshot
      const [inserted] = await db
        .insert(accountSnapshots)
        .values({
          netValue: 10_000_000,
          availableMargin: 10_000_000 - totalMarginUsed,
          marginUtilizationRate: totalMarginUsed / 10_000_000,
          totalUnrealizedPnl,
          todayRealizedPnl: 0,
          snapshotAt: new Date(),
        })
        .returning();

      snapshot = serializeRecord<AccountSnapshot>(inserted);
    }

    const response: ApiResponse<AccountSnapshot> = {
      success: true,
      data: snapshot,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/account/snapshot error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch account snapshot',
        },
      },
      { status: 500 }
    );
  }
}
