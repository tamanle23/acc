import type { SandboxRouteHandler, SandboxRequest } from '../types';
import type { WorkerTelemetry, WorkerFleetResponse } from '@/features/workers/api/worker-fleet-api';

const INITIAL_MOCK_WORKERS: WorkerTelemetry[] = [
  {
    workerId: 'worker-java-vt-01',
    hostIp: '10.0.12.44',
    runtime: 'JAVA_VIRTUAL_THREADS',
    pollDomains: ['orders', 'billing', 'inventory'],
    concurrencyLimit: 256,
    activeLeases: 42,
    tasksCompletedCount: 18450,
    errorCount: 2,
    uptimeSeconds: 86400 * 3 + 3600 * 4,
    lastHeartbeatEpochMs: Date.now() - 320,
    status: 'HEALTHY',
  },
  {
    workerId: 'worker-java-vt-02',
    hostIp: '10.0.12.45',
    runtime: 'JAVA_VIRTUAL_THREADS',
    pollDomains: ['shipping', 'notifications', 'audit'],
    concurrencyLimit: 256,
    activeLeases: 18,
    tasksCompletedCount: 14210,
    errorCount: 0,
    uptimeSeconds: 86400 * 3 + 3600 * 3,
    lastHeartbeatEpochMs: Date.now() - 580,
    status: 'HEALTHY',
  },
  {
    workerId: 'worker-node-ts-01',
    hostIp: '10.0.14.88',
    runtime: 'NODEJS_WORKER',
    pollDomains: ['webhooks', 'integrations', 'ai-agents'],
    concurrencyLimit: 64,
    activeLeases: 12,
    tasksCompletedCount: 6890,
    errorCount: 1,
    uptimeSeconds: 86400 * 1 + 3600 * 8,
    lastHeartbeatEpochMs: Date.now() - 850,
    status: 'HEALTHY',
  },
  {
    workerId: 'worker-node-ts-02',
    hostIp: '10.0.14.89',
    runtime: 'NODEJS_WORKER',
    pollDomains: ['pdf-render', 'ocr', 'transform'],
    concurrencyLimit: 32,
    activeLeases: 0,
    tasksCompletedCount: 3120,
    errorCount: 4,
    uptimeSeconds: 3600 * 12,
    lastHeartbeatEpochMs: Date.now() - 18500, // > 15s => DEGRADED
    status: 'DEGRADED',
  },
];

class WorkerFleetMockStore {
  private workers: WorkerTelemetry[] = JSON.parse(JSON.stringify(INITIAL_MOCK_WORKERS));

  public reset(): void {
    this.workers = JSON.parse(JSON.stringify(INITIAL_MOCK_WORKERS));
  }

  public getFleet(): WorkerFleetResponse {
    let healthyCount = 0;
    let degradedCount = 0;
    let offlineCount = 0;
    let drainingCount = 0;
    let activeLeases = 0;
    let totalCompletedTasks = 0;

    for (const w of this.workers) {
      if (w.status === 'HEALTHY') healthyCount++;
      else if (w.status === 'DEGRADED') degradedCount++;
      else if (w.status === 'OFFLINE') offlineCount++;
      else if (w.status === 'DRAINING') drainingCount++;
      activeLeases += w.activeLeases;
      totalCompletedTasks += w.tasksCompletedCount;
    }

    return {
      summary: {
        totalWorkers: this.workers.length,
        activeLeases,
        totalCompletedTasks,
        healthyCount,
        degradedCount,
        offlineCount,
        drainingCount,
        tasksPerSecond: activeLeases * 1.5,
      },
      workers: this.workers.map((w) => ({
        ...w,
        lastHeartbeatEpochMs:
          w.status === 'DEGRADED'
            ? Date.now() - 19000
            : w.status === 'OFFLINE'
            ? Date.now() - 45000
            : Date.now() - 450,
      })),
    };
  }

  public registerHeartbeat(workerData: Partial<WorkerTelemetry> & { workerId: string }): WorkerTelemetry {
    const existingIndex = this.workers.findIndex((w) => w.workerId === workerData.workerId);
    const now = Date.now();

    if (existingIndex >= 0) {
      this.workers[existingIndex] = {
        ...this.workers[existingIndex],
        ...workerData,
        lastHeartbeatEpochMs: now,
        status: this.workers[existingIndex].status === 'DRAINING' ? 'DRAINING' : 'HEALTHY',
      };
      return this.workers[existingIndex];
    }

    const newWorker: WorkerTelemetry = {
      workerId: workerData.workerId,
      hostIp: workerData.hostIp || '127.0.0.1',
      runtime: workerData.runtime || 'JAVA_VIRTUAL_THREADS',
      pollDomains: workerData.pollDomains || ['default'],
      concurrencyLimit: workerData.concurrencyLimit || 64,
      activeLeases: workerData.activeLeases || 0,
      tasksCompletedCount: workerData.tasksCompletedCount || 0,
      errorCount: workerData.errorCount || 0,
      uptimeSeconds: workerData.uptimeSeconds || 1,
      lastHeartbeatEpochMs: now,
      status: 'HEALTHY',
    };

    this.workers.push(newWorker);
    return newWorker;
  }

  public drain(workerId: string): boolean {
    const worker = this.workers.find((w) => w.workerId === workerId);
    if (!worker) return false;
    worker.status = 'DRAINING';
    return true;
  }
}

export const workerFleetMockStore = new WorkerFleetMockStore();

export const workerSandboxHandler: SandboxRouteHandler = {
  id: 'worker-fleet-sandbox',
  name: 'Worker Fleet Telemetry & Management Sandbox',
  priority: 15,
  matcher: (req: SandboxRequest) => {
    return req.url.startsWith('/api/v1/workflow/workers');
  },
  handler: async (req: SandboxRequest, _context?: any) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    const method = req.method.toUpperCase();

    // 1. GET /api/v1/workflow/workers
    if (method === 'GET' && path === '/api/v1/workflow/workers') {
      return {
        status: 200,
        data: workerFleetMockStore.getFleet(),
      };
    }

    // 2. POST /api/v1/workflow/workers/heartbeat
    if (method === 'POST' && path === '/api/v1/workflow/workers/heartbeat') {
      const body = req.data || {};
      const updated = workerFleetMockStore.registerHeartbeat(body);
      return {
        status: 200,
        data: { success: true, worker: updated },
      };
    }

    // 3. POST /api/v1/workflow/workers/:workerId/drain
    const drainMatch = path.match(/^\/api\/v1\/workflow\/workers\/([^/]+)\/drain$/);
    if (method === 'POST' && drainMatch) {
      const workerId = decodeURIComponent(drainMatch[1]);
      const ok = workerFleetMockStore.drain(workerId);
      if (!ok) {
        return {
          status: 404,
          data: { error: 'Worker not found', workerId },
        };
      }
      return {
        status: 200,
        data: { success: true, message: `Worker ${workerId} transitioned to DRAINING` },
      };
    }

    return null;
  },
};
