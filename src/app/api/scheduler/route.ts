import { NextRequest, NextResponse } from 'next/server';
import { scheduler } from '@/lib/scheduler/manager';

export async function GET() {
  return NextResponse.json({ success: true, data: { jobs: scheduler.getJobs() } });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, jobId, cron } = body;

  switch (action) {
    case 'start':
      scheduler.startJob(jobId);
      return NextResponse.json({ success: true });
    case 'stop':
      scheduler.stopJob(jobId);
      return NextResponse.json({ success: true });
    case 'run': {
      const result = await scheduler.runNow(jobId);
      return NextResponse.json({ success: result.success, error: result.error });
    }
    case 'updateCron': {
      const ok = scheduler.updateCron(jobId, cron);
      return NextResponse.json({ success: ok });
    }
    case 'startAll':
      scheduler.startAll();
      return NextResponse.json({ success: true });
    case 'stopAll':
      scheduler.stopAll();
      return NextResponse.json({ success: true });
    default:
      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  }
}
