import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useWorkflowExecutionStream } from '../hooks/use-workflow-execution-stream';

// Mock EventSource
class MockEventSource {
  public static instances: MockEventSource[] = [];
  public url: string;
  public onopen: (() => void) | null = null;
  public onerror: ((err: any) => void) | null = null;
  private listeners: Map<string, Array<(e: any) => void>> = new Map();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (e: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  emit(type: string, data: any) {
    const list = this.listeners.get(type) || [];
    list.forEach((cb) => cb({ data: JSON.stringify(data) }));
  }

  close() {
    // closed
  }
}

describe('useWorkflowExecutionStream', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    MockEventSource.instances = [];
    (globalThis as any).EventSource = MockEventSource;
    // Returns 0 so the hook's rafBatchRef stays falsy after the synchronous flush
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(performance.now());
      return 0;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('connects to SSE stream and updates node execution states on events', async () => {
    const { result } = renderHook(() => useWorkflowExecutionStream('wf_exec_123'), { wrapper });

    // Wait for connection
    await vi.waitFor(() => {
      expect(MockEventSource.instances.length).toBe(1);
    });

    const es = MockEventSource.instances[0];

    // Simulate connection opened
    act(() => {
      if (es.onopen) es.onopen();
    });

    expect(result.current.isConnected).toBe(true);

    // Simulate task progressing
    act(() => {
      es.emit('TASK_IN_PROGRESS', {
        workflowId: 'wf_exec_123',
        taskReferenceName: 'inventoryCheck',
        status: 'IN_PROGRESS',
      });
    });

    expect(result.current.nodeStates['inventoryCheck']).toBe('IN_PROGRESS');

    // Simulate task completion
    act(() => {
      es.emit('TASK_COMPLETED', {
        workflowId: 'wf_exec_123',
        taskReferenceName: 'inventoryCheck',
        status: 'COMPLETED',
      });
    });

    expect(result.current.nodeStates['inventoryCheck']).toBe('COMPLETED');

    // Simulate workflow completed
    act(() => {
      es.emit('WORKFLOW_COMPLETED', {
        workflowId: 'wf_exec_123',
        status: 'COMPLETED',
      });
    });

    expect(result.current.workflowStatus).toBe('COMPLETED');
  });

  it('ingests structured TASK_LOG events into FIFO ring buffer and processes HEARTBEAT', async () => {
    const { result } = renderHook(() => useWorkflowExecutionStream('wf_exec_logs_test'), { wrapper });

    await vi.waitFor(() => {
      expect(MockEventSource.instances.length).toBe(1);
    });

    const es = MockEventSource.instances[0];

    act(() => {
      if (es.onopen) es.onopen();
    });

    expect(result.current.connectionState).toBe('LIVE');

    // Simulate HEARTBEAT ping
    const hbTime = Date.now();
    act(() => {
      es.emit('HEARTBEAT', { ping: true, timestamp: hbTime });
    });

    expect(result.current.lastHeartbeatTimestamp).toBe(hbTime);

    // Simulate structured TASK_LOG event
    act(() => {
      es.emit('TASK_LOG', {
        executionId: 'wf_exec_logs_test',
        taskId: 't-101',
        taskReferenceName: 'inventoryCheck',
        workerId: 'worker-node-42',
        level: 'WARN',
        message: 'High latency detected during warehouse query',
        timestamp: hbTime + 100,
        raw: { latencyMs: 840 },
      });
    });

    expect(result.current.logs.length).toBeGreaterThan(0);
    const lastLog = result.current.logs[result.current.logs.length - 1];
    expect(lastLog.level).toBe('WARN');
    expect(lastLog.message).toBe('High latency detected during warehouse query');
    expect(lastLog.taskReferenceName).toBe('inventoryCheck');
    expect(lastLog.workerId).toBe('worker-node-42');
  });

  it('transitions connectionState through RECONNECTING and eventually to POLLING_FALLBACK after retries', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useWorkflowExecutionStream('wf_exec_reconnect'), { wrapper });

      await vi.advanceTimersByTimeAsync(20);
      expect(MockEventSource.instances.length).toBe(1);

      const es1 = MockEventSource.instances[0];

      // Simulate connection drop
      act(() => {
        if (es1.onerror) es1.onerror(new Error('Connection drop'));
      });

      expect(result.current.connectionState).toBe('RECONNECTING');
      expect(result.current.retryAttempt).toBe(1);
      expect(result.current.nextRetryDelayMs).toBe(1000);

      // Fast-forward backoff delay (1s) to trigger reconnect attempt
      await vi.advanceTimersByTimeAsync(1100);
      expect(MockEventSource.instances.length).toBe(2);

      // 5 retries are allowed; the 6th failure engages polling fallback
      for (let i = 2; i <= 6; i++) {
        const curEs = MockEventSource.instances[MockEventSource.instances.length - 1];
        act(() => {
          if (curEs.onerror) curEs.onerror(new Error(`Failure ${i}`));
        });
        if (i < 6) {
          await vi.advanceTimersByTimeAsync(16000);
        }
      }

      // Max retries reached -> POLLING_FALLBACK
      expect(result.current.connectionState).toBe('POLLING_FALLBACK');
      expect(result.current.usePollingFallback).toBe(true);
      expect(result.current.isConnected).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
