import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { accountSnapshots } from '@/db/schema';
import { positions } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import type { ApiResponse } from '@/types/api';
import type { AccountSnapshot } from '@/types/domain';
import { serializeRecord } from '@/lib/serialize';

const DEFAULT_NET_VALUE = 10_000_000;

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

      const netValue = DEFAULT_NET_VALUE;

      // Insert computed snapshot
      const [inserted] = await db
        .insert(accountSnapshots)
        .values({
          netValue,
          availableMargin: netValue - totalMarginUsed,
          marginUtilizationRate: totalMarginUsed / netValue,
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

// POST /api/account/snapshot - Update account net value
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { netValue } = body;

    if (typeof netValue !== 'number' || netValue <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'netValue must be a positive number' } },
        { status: 400 }
      );
    }

    const positionGroups = await db.select().from(positions);
    const totalUnrealizedPnl = positionGroups.reduce(
      (sum, p) => sum + (p.unrealizedPnl as number || 0),
      0
    );
    const totalMarginUsed = positionGroups.reduce(
      (sum, p) => sum + (p.totalMarginUsed as number || 0),
      0
    );

    const [inserted] = await db
      .insert(accountSnapshots)
      .values({
        netValue,
        availableMargin: netValue - totalMarginUsed,
        marginUtilizationRate: netValue > 0 ? totalMarginUsed / netValue : 0,
        totalUnrealizedPnl,
        todayRealizedPnl: 0,
        snapshotAt: new Date(),
      })
      .returning();

    const response: ApiResponse<AccountSnapshot> = {
      success: true,
      data: serializeRecord<AccountSnapshot>(inserted),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('POST /api/account/snapshot error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update account snapshot' } },
      { status: 500 }
    );
  }
}

// DELETE /api/account/snapshot - Reset all snapshots and positions
export async function DELETE(request: NextRequest) {
  try {
    await db.delete(accountSnapshots).where(sql`1=1`);
    await db.delete(positions).where(sql`1=1`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/account/snapshot error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reset data' } },
      { status: 500 }
    );
  }
}
