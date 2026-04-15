import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { executionDrafts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { ApiResponse } from '@/types/api';
import type { ExecutionDraft } from '@/types/domain';
import { serializeRecord } from '@/lib/serialize';

// GET /api/execution-drafts/[id] - Get single execution draft
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [result] = await db
      .select()
      .from(executionDrafts)
      .where(eq(executionDrafts.id, id))
      .limit(1);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Execution draft not found' },
        },
        { status: 404 }
      );
    }

    const response: ApiResponse<ExecutionDraft> = {
      success: true,
      data: serializeRecord<ExecutionDraft>(result),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/execution-drafts/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch execution draft',
        },
      },
      { status: 500 }
    );
  }
}

// PATCH /api/execution-drafts/[id] - Update execution draft
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, any> = {
      ...body,
      updatedAt: new Date(),
    };

    if (body.status === 'submitted' && !body.submittedAt) {
      updates.submittedAt = new Date();
    }

    const [updated] = await db
      .update(executionDrafts)
      .set(updates)
      .where(eq(executionDrafts.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Execution draft not found' },
        },
        { status: 404 }
      );
    }

    const response: ApiResponse<ExecutionDraft> = {
      success: true,
      data: serializeRecord<ExecutionDraft>(updated),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('PATCH /api/execution-drafts/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update execution draft',
        },
      },
      { status: 500 }
    );
  }
}
