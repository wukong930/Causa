import * as cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';

export interface ScheduledJob {
  id: string;
  name: string;
  cron: string;
  endpoint: string;
  enabled: boolean;
  running: boolean;
  lastRun?: string;
  lastResult?: 'success' | 'error';
  lastError?: string;
  consecutiveFailures: number;
}

export interface SchedulerHealthSummary {
  totalJobs: number;
  enabledJobs: number;
  degradedJobs: string[];  // jobs with >= 3 consecutive failures
  lastActivity?: string;
  jobs: Array<{ id: string; name: string; status: string; lastRun?: string; lastError?: string }>;
}

const DEFAULT_JOBS: Omit<ScheduledJob, 'running' | 'consecutiveFailures'>[] = [
  { id: 'ingest', name: '行情数据', cron: '5 10,11,14,15 * * 1-5', endpoint: '/api/cron/ingest', enabled: true },
  { id: 'context', name: '上下文刷新', cron: '0 */4 * * *', endpoint: '/api/cron/context', enabled: true },
  { id: 'alerts', name: '预警触发', cron: '0 * * * *', endpoint: '/api/alerts/cron', enabled: true },
  { id: 'evolution', name: '假设演化', cron: '0 8 * * *', endpoint: '/api/cron/evolution', enabled: true },
  { id: 'risk', name: '风险计算', cron: '30 8 * * *', endpoint: '/api/cron/risk', enabled: true },
  { id: 'auto-eval', name: '信号评判', cron: '0 9 * * *', endpoint: '/api/cron/auto-eval', enabled: true },
  { id: 'track-outcomes', name: '绩效追踪', cron: '30 16 * * 1-5', endpoint: '/api/cron/track-outcomes', enabled: true },
  { id: 'cleanup', name: '数据清理', cron: '0 3 * * *', endpoint: '/api/cron/cleanup', enabled: true },
];

class SchedulerManager {
  private jobs: Map<string, ScheduledJob> = new Map();
  private tasks: Map<string, ScheduledTask> = new Map();
  private baseUrl = `http://localhost:${process.env.PORT || 3000}`;
  private initialized = false;

  init() {
    if (this.initialized) return;
    this.initialized = true;
    for (const def of DEFAULT_JOBS) {
      this.jobs.set(def.id, { ...def, running: false, consecutiveFailures: 0 });
    }
    this.startAll();
    console.log('[Scheduler] Initialized with', this.jobs.size, 'jobs');
  }

  getJobs(): ScheduledJob[] {
    this.init();
    return Array.from(this.jobs.values());
  }

  startJob(id: string) {
    this.init();
    const job = this.jobs.get(id);
    if (!job) return;
    this.tasks.get(id)?.stop();
    const task = cron.schedule(job.cron, () => this.execute(id));
    this.tasks.set(id, task);
    job.enabled = true;
  }

  stopJob(id: string) {
    this.init();
    const job = this.jobs.get(id);
    if (!job) return;
    this.tasks.get(id)?.stop();
    this.tasks.delete(id);
    job.enabled = false;
  }

  async runNow(id: string): Promise<{ success: boolean; error?: string }> {
    this.init();
    return this.execute(id);
  }

  updateCron(id: string, expr: string) {
    const job = this.jobs.get(id);
    if (!job || !cron.validate(expr)) return false;
    job.cron = expr;
    if (job.enabled) this.startJob(id);
    return true;
  }

  startAll() {
    for (const id of this.jobs.keys()) this.startJob(id);
  }

  stopAll() {
    for (const id of this.jobs.keys()) this.stopJob(id);
  }

  private async execute(id: string): Promise<{ success: boolean; error?: string }> {
    const job = this.jobs.get(id);
    if (!job || job.running) return { success: false, error: 'busy' };
    job.running = true;
    try {
      const res = await fetch(`${this.baseUrl}${job.endpoint}`, {
        method: 'POST',
        headers: {
          'x-cron-secret': process.env.CRON_SECRET || '',
          'Authorization': `Bearer ${process.env.API_SECRET || ''}`,
        },
      });
      job.lastRun = new Date().toISOString();
      if (res.ok) {
        job.lastResult = 'success';
        job.lastError = undefined;
        job.consecutiveFailures = 0;
        return { success: true };
      }
      const text = await res.text().catch(() => res.statusText);
      job.lastResult = 'error';
      job.lastError = text;
      job.consecutiveFailures++;
      if (job.consecutiveFailures >= 3) {
        console.error(`[Scheduler] Job "${job.name}" degraded: ${job.consecutiveFailures} consecutive failures`);
      }
      return { success: false, error: text };
    } catch (e: any) {
      job.lastRun = new Date().toISOString();
      job.lastResult = 'error';
      job.lastError = e.message;
      job.consecutiveFailures++;
      if (job.consecutiveFailures >= 3) {
        console.error(`[Scheduler] Job "${job.name}" degraded: ${job.consecutiveFailures} consecutive failures`);
      }
      return { success: false, error: e.message };
    } finally {
      job.running = false;
    }
  }
  getHealthSummary(): SchedulerHealthSummary {
    this.init();
    const jobs = Array.from(this.jobs.values());
    const degraded = jobs.filter((j) => j.consecutiveFailures >= 3).map((j) => j.id);
    const lastActivity = jobs
      .filter((j) => j.lastRun)
      .sort((a, b) => (b.lastRun ?? '').localeCompare(a.lastRun ?? ''))[0]?.lastRun;

    return {
      totalJobs: jobs.length,
      enabledJobs: jobs.filter((j) => j.enabled).length,
      degradedJobs: degraded,
      lastActivity,
      jobs: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        status: !j.enabled ? 'disabled' : j.consecutiveFailures >= 3 ? 'degraded' : j.lastResult === 'error' ? 'warning' : 'ok',
        lastRun: j.lastRun,
        lastError: j.consecutiveFailures > 0 ? j.lastError : undefined,
      })),
    };
  }
}

export const scheduler = new SchedulerManager();
