import { describe, it, expect, vi } from 'vitest';
import { WorkflowWorkerHost } from '../host/WorkflowWorkerHost.js';
import { WorkerTransportClient, TaskSnapshotDto } from '../types.js';

describe('Polyglot Saga Compensation Contract Tests', () => {
  it('should receive forward task, execute, and then receive compensation task on workflow failure', async () => {
    // 1. Forward Task: dispatch-package
    const forwardTask: TaskSnapshotDto = {
      taskId: 'wf_polyglot_1_step2-dispatch-package_att1',
      taskReferenceName: 'step2-dispatch-package',
      taskType: 'SIMPLE',
      domain: 'logistics',
      status: 'SCHEDULED',
      attempt: 1,
      inputData: { packageId: 'PKG-7701' },
      outputData: {},
      visibleAtEpochMs: Date.now(),
      responseTimeoutMs: 30000,
    };

    // 2. Compensating Task: cancel-packing-worker
    const compensationTask: TaskSnapshotDto = {
      taskId: 'wf_polyglot_1_step2-dispatch-package_compensate',
      taskReferenceName: 'step2-dispatch-package_COMPENSATE',
      taskType: 'cancel-packing-worker',
      domain: 'logistics',
      status: 'SCHEDULED',
      attempt: 1,
      inputData: {
        packageId: 'PKG-7701',
        _originalTaskId: 'wf_polyglot_1_step2-dispatch-package_att1',
        _originalOutput: { trackingNumber: 'TRK-9902' },
      },
      outputData: {},
      visibleAtEpochMs: Date.now(),
      responseTimeoutMs: 30000,
    };

    let forwardPolled = false;
    let compPolled = false;
    const reportedTasks: Array<{ taskId: string; completed: boolean; output: any }> = [];

    const mockTransport: WorkerTransportClient = {
      pollBatch: vi.fn(async (_tenantId, taskType) => {
        if (taskType === 'SIMPLE' && !forwardPolled) {
          forwardPolled = true;
          return [forwardTask];
        }
        if (taskType === 'cancel-packing-worker' && !compPolled) {
          compPolled = true;
          return [compensationTask];
        }
        return [];
      }),
      reportTaskResult: vi.fn(async (taskId, _workerId, completed, output) => {
        reportedTasks.push({ taskId, completed, output });
      }),
      heartbeat: vi.fn(async () => true),
    };

    const host = new WorkflowWorkerHost(mockTransport, 'ts-logistics-worker-1');

    // Register forward handler
    host.registerSimple('SIMPLE', (ctx) => {
      expect(ctx.input.packageId).toBe('PKG-7701');
      return { trackingNumber: 'TRK-9902', status: 'DISPATCHED' };
    }, { domain: 'logistics', basePollIntervalMs: 10 });

    // Register compensation handler
    host.registerSimple('cancel-packing-worker', (ctx) => {
      expect(ctx.input.packageId).toBe('PKG-7701');
      expect(ctx.input._originalOutput.trackingNumber).toBe('TRK-9902');
      return { cancelled: true, packageId: ctx.input.packageId };
    }, { domain: 'logistics', basePollIntervalMs: 10 });

    await host.start();

    // Wait for polling and executions
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(reportedTasks).toHaveLength(2);

    // Assert Forward Task Result
    expect(reportedTasks[0].taskId).toBe('wf_polyglot_1_step2-dispatch-package_att1');
    expect(reportedTasks[0].completed).toBe(true);
    expect(reportedTasks[0].output.trackingNumber).toBe('TRK-9902');

    // Assert Compensation Task Result
    expect(reportedTasks[1].taskId).toBe('wf_polyglot_1_step2-dispatch-package_compensate');
    expect(reportedTasks[1].completed).toBe(true);
    expect(reportedTasks[1].output.cancelled).toBe(true);

    await host.shutdown();
  });
});
