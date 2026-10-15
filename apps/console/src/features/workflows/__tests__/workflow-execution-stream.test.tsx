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
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 10);
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
  });

  afterEach(() => {
    queryClient.clear();
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

  it('falls back gracefully to polling when SSE connection errors out', async () => {
    const { result } = renderHook(() => useWorkflowExecutionStream('wf_exec_fallback'), { wrapper });

    await vi.waitFor(() => {
      expect(MockEventSource.instances.length).toBe(1);
    });

    const es = MockEventSource.instances[0];

    // Trigger SSE error
    act(() => {
      if (es.onerror) es.onerror(new Error('SSE connection failed'));
    });

    expect(result.current.usePollingFallback).toBe(true);
    expect(result.current.isConnected).toBe(false);
  });
});
