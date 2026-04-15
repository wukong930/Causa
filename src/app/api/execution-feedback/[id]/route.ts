import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { executionFeedback } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { ApiResponse } from '@/types/api';
import type { ExecutionFeedback } from '@/types/domain';
import { serializeRecord } from '@/lib/serialize';

// GET /api/execution-feedback/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await db
      .select()
      .from(executionFeedback)
      .where(eq(executionFeedback.id, id))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Execution feedback not found',
          },
        },
        { status: 404 }
      );
    }

    const response: ApiResponse<ExecutionFeedback> = {
      success: true,
      data: serializeRecord<ExecutionFeedback>(result[0]),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/execution-feedback/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch execution feedback',
        },
      },
      { status: 500 }
    );
  }
}
