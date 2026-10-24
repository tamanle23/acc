import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExecutionRunDrawer, type ExecutionRunDrawerProps } from '../execution/execution-run-drawer';
import type { WorkflowExecutionStreamState } from '@/features/workflows/hooks/use-workflow-execution-stream';

const testQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const render = (ui: React.ReactElement) =>
  rtlRender(<QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>);

describe('ExecutionRunDrawer Component', () => {
  const mockStream: WorkflowExecutionStreamState = {
    workflowStatus: 'RUNNING',
    nodeStates: {
      validateOrder: 'COMPLETED',
      processPayment: 'IN_PROGRESS',
      shipOrder: 'PENDING',
    },
    logs: [
      {
        id: 'log-1',
        time: '12:00:01',
        timestamp: 1700000001000,
        level: 'INFO',
        message: 'Order validation started',
        taskReferenceName: 'validateOrder',
        workerId: 'worker-a',
      },
      {
        id: 'log-2',
        time: '12:00:03',
        timestamp: 1700000003000,
        level: 'SUCCESS',
        message: 'Validation passed successfully',
        taskReferenceName: 'validateOrder',
        workerId: 'worker-a',
      },
      {
        id: 'log-3',
        time: '12:00:04',
        timestamp: 1700000004000,
        level: 'WARN',
        message: 'High latency detected during card authorization',
        taskReferenceName: 'processPayment',
        workerId: 'worker-b',
      },
      {
        id: 'log-4',
        time: '12:00:05',
        timestamp: 1700000005000,
        level: 'ERROR',
        message: 'Payment gateway timeout',
        taskReferenceName: 'processPayment',
        workerId: 'worker-b',
      },
    ],
    connectionState: 'LIVE',
    isConnected: true,
    isStreaming: true,
    retryAttempt: 0,
    nextRetryDelayMs: null,
    lastHeartbeatTimestamp: Date.now(),
    error: null,
  };

  it('renders minimized by default and expands on click', () => {
    render(
      <ExecutionRunDrawer
        executionId="exec-123"
        stream={mockStream}
      />
    );

    const drawer = screen.getByTestId('execution-run-drawer');
    expect(drawer).toBeDefined();
    expect(drawer.classList.contains('h-12')).toBe(true);
    expect(screen.getByText('exec-123')).toBeDefined();
    expect(screen.getByText('RUNNING')).toBeDefined();
    expect(screen.getByText(/Live SSE/)).toBeDefined();

    // Expand
    const toggleBtn = screen.getByTestId('execution-drawer-toggle-btn');
    fireEvent.click(toggleBtn);
    expect(drawer.classList.contains('h-72')).toBe(true);
    expect(screen.getByTestId('execution-tab-logs')).toBeDefined();
  });

  it('renders logs and filters by log level chips', () => {
    render(
      <ExecutionRunDrawer
        executionId="exec-123"
        stream={mockStream}
      />
    );

    // Expand to see logs
    fireEvent.click(screen.getByTestId('execution-drawer-toggle-btn'));

    // Verify all 4 logs initially rendered
    expect(screen.getByText('Order validation started')).toBeDefined();
    expect(screen.getByText('Validation passed successfully')).toBeDefined();
    expect(screen.getByText('Payment gateway timeout')).toBeDefined();

    // Filter by ERROR chip
    const errorChip = screen.getByTestId('log-level-chip-ERROR');
    fireEvent.click(errorChip);

    // Only error log should remain
    expect(screen.getByText('Payment gateway timeout')).toBeDefined();
    expect(screen.queryByText('Order validation started')).toBeNull();
  });

  it('filters logs by search query (regex and substring)', () => {
    render(
      <ExecutionRunDrawer
        executionId="exec-123"
        stream={mockStream}
      />
    );

    fireEvent.click(screen.getByTestId('execution-drawer-toggle-btn'));

    const searchInput = screen.getByTestId('log-search-input');
    fireEvent.change(searchInput, { target: { value: 'latency' } });

    expect(screen.getByText(/High latency detected/)).toBeDefined();
    expect(screen.queryByText('Order validation started')).toBeNull();
    expect(screen.queryByText('Payment gateway timeout')).toBeNull();
  });

  it('coordinates task step selection and filter', () => {
    const onSelectTaskRef = vi.fn();
    render(
      <ExecutionRunDrawer
        executionId="exec-123"
        stream={mockStream}
        availableTaskRefs={['validateOrder', 'processPayment', 'shipOrder']}
        selectedTaskRef="processPayment"
        onSelectTaskRef={onSelectTaskRef}
      />
    );

    // Auto-expands when selectedTaskRef is present
    const drawer = screen.getByTestId('execution-run-drawer');
    expect(drawer.classList.contains('h-72')).toBe(true);

    // Shows only processPayment logs
    expect(screen.getByText('Payment gateway timeout')).toBeDefined();
    expect(screen.queryByText('Order validation started')).toBeNull();

    // Switch task filter via dropdown
    const select = screen.getByTestId('log-task-filter-select');
    fireEvent.change(select, { target: { value: 'validateOrder' } });
    expect(onSelectTaskRef).toHaveBeenCalledWith('validateOrder');
  });

  it('switches between tabs (Tasks, Payload, Diff, Diagnostics)', () => {
    render(
      <ExecutionRunDrawer
        executionId="exec-123"
        stream={mockStream}
        snapshot={{
          executionId: 'exec-123',
          workflowId: 'order-flow',
          version: 1,
          status: 'RUNNING',
          input: { orderId: 'ORD-999' },
          output: { step: 1 },
          startTime: 1000,
          tenantId: 'tenant-acme',
          workspaceId: 'ws-prod',
        }}
      />
    );

    fireEvent.click(screen.getByTestId('execution-drawer-toggle-btn'));

    // Switch to Tasks/Timeline tab
    fireEvent.click(screen.getByTestId('execution-tab-timeline'));
    expect(screen.getByText('validateOrder')).toBeDefined();
    expect(screen.getByText('processPayment')).toBeDefined();

    // Switch to Payload tab
    fireEvent.click(screen.getByTestId('execution-tab-payload'));
    expect(screen.getByText(/Workflow Input Payload/)).toBeDefined();
    expect(screen.getByText(/"orderId": "ORD-999"/)).toBeDefined();

    // Switch to Diagnostics tab
    fireEvent.click(screen.getByTestId('execution-tab-diagnostics'));
    expect(screen.getByText('tenant-acme / ws-prod')).toBeDefined();
  });

  it('renders DLQ Repair & Replay action banner when inspecting a failed task', () => {
    const failedStream: WorkflowExecutionStreamState = {
      ...mockStream,
      nodeStates: {
        validateOrder: 'COMPLETED',
        processPayment: 'FAILED',
      },
    };

    render(
      <ExecutionRunDrawer
        executionId="exec-123"
        stream={failedStream}
        selectedTaskRef="processPayment"
      />
    );

    // Switch to Timeline tab
    fireEvent.click(screen.getByTestId('execution-tab-timeline'));
    expect(screen.getByTestId('timeline-dlq-action-banner')).toBeDefined();
    expect(screen.getByTestId('drawer-repair-replay-btn')).toBeDefined();
    expect(screen.getByText('Task [processPayment] Failed')).toBeDefined();
  });
});
