import { NextRequest, NextResponse } from 'next/server';
import { scheduler } from '@/lib/scheduler/manager';

export async function GET() {
  return NextResponse.json({ jobs: scheduler.getJobs() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, jobId, cron } = body;

  switch (action) {
    case 'start':
      scheduler.startJob(jobId);
      return NextResponse.json({ ok: true });
    case 'stop':
      scheduler.stopJob(jobId);
      return NextResponse.json({ ok: true });
    case 'run': {
      const result = await scheduler.runNow(jobId);
      return NextResponse.json(result);
    }
    case 'updateCron': {
      const ok = scheduler.updateCron(jobId, cron);
      return NextResponse.json({ ok });
    }
    case 'startAll':
      scheduler.startAll();
      return NextResponse.json({ ok: true });
    case 'stopAll':
      scheduler.stopAll();
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
