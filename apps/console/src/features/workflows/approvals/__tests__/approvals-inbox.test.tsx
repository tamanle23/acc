import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApprovalsInbox } from '../approvals-inbox';
import { approvalTaskMockStore } from '@/core/sandbox';

class MockEventSource {
  public static instances: MockEventSource[] = [];
  public url: string;
  public onopen: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public close = vi.fn();
  private listeners: Map<string, Array<(e: unknown) => void>> = new Map();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 5);
  }

  addEventListener(type: string, listener: (e: unknown) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  emit(type: string, data: unknown) {
    const list = this.listeners.get(type) || [];
    list.forEach((cb) => cb({ data: JSON.stringify(data) }));
  }
}

describe('ApprovalsInbox Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    approvalTaskMockStore.reset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    MockEventSource.instances = [];
    (globalThis as unknown as { EventSource: unknown }).EventSource = MockEventSource;
    if (typeof window !== 'undefined') {
      (window as unknown as { EventSource: unknown }).EventSource = MockEventSource;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders approvals inbox with mock tasks and headers', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ApprovalsInbox />
      </QueryClientProvider>
    );

    expect(screen.getByText('Human-in-the-Loop Approvals Inbox')).toBeDefined();
    expect(screen.getByText('Vendor Compliance & Security Review')).toBeDefined();
    expect(screen.getByText('Carrier Zone Rate Schedule Mutation')).toBeDefined();
    expect(screen.getAllByText('Acme Logistics Ltd').length).toBeGreaterThanOrEqual(1);
  });

  it('allows approving a pending task', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ApprovalsInbox />
      </QueryClientProvider>
    );

    const approveButtons = screen.getAllByText('Approve Step');
    expect(approveButtons.length).toBeGreaterThan(0);

    fireEvent.click(approveButtons[0]);
    expect(screen.getByText('APPROVED')).toBeDefined();
  });

  it('opens rationale dialog and rejects task with audit commentary', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ApprovalsInbox />
      </QueryClientProvider>
    );

    const rejectButtons = screen.getAllByText('Reject');
    expect(rejectButtons.length).toBeGreaterThan(0);

    fireEvent.click(rejectButtons[0]);
    expect(screen.getByText('Reject Workflow Step')).toBeDefined();

    const textarea = screen.getByPlaceholderText(/Provide specific justification or required modifications/i);
    fireEvent.change(textarea, { target: { value: 'Compliance risk too high for tier 1' } });

    const confirmButton = screen.getByText('Confirm Rejection');
    fireEvent.click(confirmButton);

    expect(screen.getByText('REJECTED')).toBeDefined();
  });

  it('filters approval tasks based on search query', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ApprovalsInbox />
      </QueryClientProvider>
    );

    const searchInput = screen.getByPlaceholderText('Filter approvals...');
    fireEvent.change(searchInput, { target: { value: 'Acme' } });

    expect(screen.getByText('Vendor Compliance & Security Review')).toBeDefined();
    expect(screen.queryByText('Carrier Zone Rate Schedule Mutation')).toBeNull();
  });

  it('handles incoming SSE event and prepends new approval task', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ApprovalsInbox />
      </QueryClientProvider>
    );

    expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1);
    const sse = MockEventSource.instances[0];

    // Trigger mock incoming SSE message
    act(() => {
      sse.emit('APPROVAL_REQUESTED', {
        entityTypeId: 99,
        recordId: 777,
        requestedBy: 'auditor@unipost.io',
      });
    });

    expect(screen.getByText('Entity Type #99 Workflow')).toBeDefined();
    expect(screen.getByText('auditor@unipost.io')).toBeDefined();
  });

  it('handles SSE error and attempts reconnect without crashing', () => {
    vi.useFakeTimers();

    render(
      <QueryClientProvider client={queryClient}>
        <ApprovalsInbox />
      </QueryClientProvider>
    );

    expect(MockEventSource.instances.length).toBe(1);
    const sse = MockEventSource.instances[0];

    // Simulate connection error
    act(() => {
      if (sse.onerror) sse.onerror();
    });

    expect(sse.close).toHaveBeenCalled();

    // Advance 5s reconnect timer
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(MockEventSource.instances.length).toBe(2);
    vi.useRealTimers();
  });
});
