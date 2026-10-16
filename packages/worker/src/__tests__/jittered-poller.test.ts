import { describe, it, expect, vi } from 'vitest';
import { TaskPoller } from '../host/TaskPoller.js';
import { WorkerConfig, WorkerTransportClient } from '../types.js';

describe('Phase 38: Worker SDK Jitter & Anti-Thundering Herd Tests', () => {
  it('should calculate exponential backoff with +20% randomized jitter bounds', () => {
    const config: Required<WorkerConfig> = {
      taskType: 'SIMPLE',
      tenantId: 'test-tenant',
      domain: 'default',
      maxConcurrency: 5,
      basePollIntervalMs: 500,
      maxPollIntervalMs: 5000,
      pollBatchSize: 1,
      autoHeartbeatIntervalMs: 10000,
    };

    const mockTransport: WorkerTransportClient = {
      pollBatch: vi.fn(async () => []),
      reportTaskResult: vi.fn(async () => {}),
      heartbeat: vi.fn(async () => true),
    };

    const poller = new TaskPoller(
      config,
      async () => ({}),
      [],
      mockTransport,
      'test-worker-1',
      new AbortController()
    );

    // Iteration 0 (0 consecutive empty polls)
    // interval = 500, jitter in [0, 100] -> [500, 600]
    const b0 = poller.calculateJitteredBackoff(0);
    expect(b0).toBeGreaterThanOrEqual(500);
    expect(b0).toBeLessThanOrEqual(600);

    // Iteration 1 (1 consecutive empty poll)
    // interval = min(5000, 500 * 2^1) = 1000, jitter in [0, 200] -> [1000, 1200]
    const b1 = poller.calculateJitteredBackoff(1);
    expect(b1).toBeGreaterThanOrEqual(1000);
    expect(b1).toBeLessThanOrEqual(1200);

    // Iteration 2 (2 consecutive empty polls)
    // interval = min(5000, 500 * 2^2) = 2000, jitter in [0, 400] -> [2000, 2400]
    const b2 = poller.calculateJitteredBackoff(2);
    expect(b2).toBeGreaterThanOrEqual(2000);
    expect(b2).toBeLessThanOrEqual(2400);

    // Iteration 5 (capped at maxPollIntervalMs = 5000)
    // interval = min(5000, 500 * 2^5 = 16000) = 5000, jitter in [0, 1000] -> [5000, 6000]
    const b5 = poller.calculateJitteredBackoff(5);
    expect(b5).toBeGreaterThanOrEqual(5000);
    expect(b5).toBeLessThanOrEqual(6000);
  });
});
