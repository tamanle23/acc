import { describe, it, expect, vi } from 'vitest';
import { WorkflowWorkerHost } from '../host/WorkflowWorkerHost.js';
import { TaskOutcome, WorkerTransportClient, TaskSnapshotDto } from '../types.js';

describe('WorkflowWorkerHost Unit Tests', () => {
  it('should register handlers and poll/execute tasks successfully', async () => {
    const queuedTask: TaskSnapshotDto = {
      taskId: 'wf1_charge_att1',
      taskReferenceName: 'charge',
      taskType: 'CHARGE_CARD',
      domain: 'default',
      status: 'SCHEDULED',
      attempt: 1,
      inputData: { amount: 150 },
      outputData: {},
      visibleAtEpochMs: Date.now(),
      responseTimeoutMs: 30000,
    };

    let polled = false;
    let reported = false;
    let reportPayload: any = null;

    const mockTransport: WorkerTransportClient = {
      pollBatch: vi.fn(async () => {
        if (!polled) {
          polled = true;
          return [queuedTask];
        }
        return [];
      }),
      reportTaskResult: vi.fn(async (_taskId, _workerId, completed, output) => {
        reported = true;
        reportPayload = { completed, output };
      }),
      heartbeat: vi.fn(async () => true),
    };

    const host = new WorkflowWorkerHost(mockTransport, 'test-ts-worker');

    host.registerSimple('CHARGE_CARD', (ctx) => {
      ctx.log('Processing charge');
      expect(ctx.input.amount).toBe(150);
      return { chargeId: 'ch_999', status: 'SUCCESS' };
    }, { basePollIntervalMs: 10 });

    await host.start();

    // Await execution
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(reported).toBe(true);
    expect(reportPayload.completed).toBe(true);
    expect(reportPayload.output).toEqual({ chargeId: 'ch_999', status: 'SUCCESS' });

    await host.shutdown();
  });

  it('should support in-progress callback deferrals', async () => {
    const queuedTask: TaskSnapshotDto = {
      taskId: 'wf2_async_att1',
      taskReferenceName: 'asyncStep',
      taskType: 'ASYNC_STEP',
      domain: 'default',
      status: 'SCHEDULED',
      attempt: 1,
      inputData: {},
      outputData: {},
      visibleAtEpochMs: Date.now(),
      responseTimeoutMs: 30000,
    };

    let reported = false;
    let reportedCallbackAfter = 0;

    const mockTransport: WorkerTransportClient = {
      pollBatch: vi.fn(async () => [queuedTask]),
      reportTaskResult: vi.fn(async (_taskId, _workerId, completed, _out, _err, callbackAfter) => {
        reported = true;
        reportedCallbackAfter = callbackAfter ?? 0;
      }),
      heartbeat: vi.fn(async () => true),
    };

    const host = new WorkflowWorkerHost(mockTransport, 'test-worker-async');

    host.register({ taskType: 'ASYNC_STEP', basePollIntervalMs: 10 }, async () => {
      return TaskOutcome.inProgress(15, { partial: true });
    });

    await host.start();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(reported).toBe(true);
    expect(reportedCallbackAfter).toBe(15);

    await host.shutdown();
  });
});
