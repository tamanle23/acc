import { describe, it, expect, vi } from 'vitest';
import { AutoHeartbeatMiddleware } from '../middleware/AutoHeartbeatMiddleware.js';
import { SchemaValidationMiddleware } from '../middleware/SchemaValidationMiddleware.js';
import { ErrorClassificationMiddleware } from '../middleware/ErrorClassificationMiddleware.js';
import { TaskContext, TaskOutcome } from '../types.js';

describe('TypeScript Worker Middleware Pipeline', () => {
  it('AutoHeartbeatMiddleware should trigger heartbeat periodically and clear timer on completion', async () => {
    let heartbeats = 0;
    const ctx: TaskContext = {
      taskId: 't1',
      workflowId: 'w1',
      tenantId: 'system',
      workspaceId: 'default',
      taskType: 'LONG_TASK',
      referenceName: 'longTask',
      domain: 'default',
      attempt: 1,
      input: {},
      log: vi.fn(),
      getLogs: () => [],
      heartbeat: vi.fn(async () => {
        heartbeats++;
      }),
      signal: new AbortController().signal,
    };

    const mw = new AutoHeartbeatMiddleware(30);

    const outcome = await mw.invoke(ctx, async () => {
      await new Promise((res) => setTimeout(res, 80));
      return TaskOutcome.completed({ done: true });
    });

    expect(outcome.status).toBe('COMPLETED');
    expect(heartbeats).toBeGreaterThanOrEqual(2);
  });

  it('SchemaValidationMiddleware should enforce required keys', async () => {
    const mw = new SchemaValidationMiddleware(['orderId', 'amount']);

    const validCtx: TaskContext = {
      taskId: 't2',
      workflowId: 'w1',
      tenantId: 'system',
      workspaceId: 'default',
      taskType: 'SIMPLE',
      referenceName: 'ref',
      domain: 'default',
      attempt: 1,
      input: { orderId: 'ord_123', amount: 50 },
      log: vi.fn(),
      getLogs: () => [],
      heartbeat: vi.fn(),
      signal: new AbortController().signal,
    };

    const validResult = await mw.invoke(validCtx, async () => TaskOutcome.completed());
    expect(validResult.status).toBe('COMPLETED');

    const invalidCtx = { ...validCtx, input: { orderId: 'ord_123' } };
    const invalidResult = await mw.invoke(invalidCtx, async () => TaskOutcome.completed());
    expect(invalidResult.status).toBe('FAILED');
    if (invalidResult.status === 'FAILED') {
      expect(invalidResult.errorMessage).toContain('Missing required input field: amount');
    }
  });

  it('ErrorClassificationMiddleware should distinguish retryable from terminal errors', async () => {
    const mw = new ErrorClassificationMiddleware();

    const ctx: TaskContext = {
      taskId: 't3',
      workflowId: 'w1',
      tenantId: 'system',
      workspaceId: 'default',
      taskType: 'SIMPLE',
      referenceName: 'ref',
      domain: 'default',
      attempt: 1,
      input: {},
      log: vi.fn(),
      getLogs: () => [],
      heartbeat: vi.fn(),
      signal: new AbortController().signal,
    };

    const retryableRes = await mw.invoke(ctx, async () => {
      throw new Error('Connection reset by peer');
    });
    expect(retryableRes.status).toBe('FAILED');
    if (retryableRes.status === 'FAILED') {
      expect(retryableRes.retryable).toBe(true);
    }

    const terminalRes = await mw.invoke(ctx, async () => {
      throw new TypeError('Cannot read property of undefined');
    });
    expect(terminalRes.status).toBe('FAILED');
    if (terminalRes.status === 'FAILED') {
      expect(terminalRes.retryable).toBe(false);
    }
  });
});
