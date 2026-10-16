import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApprovalTable } from '../components/approval-table';
import { HumanDecisionModal } from '../components/human-decision-modal';
import type { ApprovalTask } from '@unipost/client';

const mockTask: ApprovalTask = {
  id: 'appr_01',
  taskId: 'task_exec_901_complianceReview',
  workflowId: 'wf_exec_901',
  workflowKey: 'order-fulfillment-v1',
  workflowName: 'Order Fulfillment Pipeline',
  taskReferenceName: 'complianceReview',
  status: 'WAITING_FOR_APPROVAL',
  role: 'ROLE_COMPLIANCE_OFFICER',
  instructions: 'Verify international export declaration documents and customs clearance certificate.',
  slaMinutes: 120,
  createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  dueAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
  claimedBy: null,
  claimedAt: null,
  slaBreached: false,
  inputData: {
    orderId: 'ORD-2026-9921',
    declaredValue: 45000000,
  },
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

describe('Human-in-the-Loop Approvals UI', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  it('renders approval task details and claim trigger in ApprovalTable', () => {
    const onReviewMock = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <ApprovalTable
          tasks={[mockTask]}
          onReviewTask={onReviewMock}
          currentUserId="satnaing"
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Order Fulfillment Pipeline')).toBeDefined();
    expect(screen.getByText('complianceReview')).toBeDefined();
    expect(screen.getByText('ROLE_COMPLIANCE_OFFICER')).toBeDefined();
    expect(screen.getByText('Claim')).toBeDefined();
    expect(screen.getByText('Claim & Review')).toBeDefined();
  });

  it('renders HumanDecisionModal with upstream payload context and validation enforcement', async () => {
    const onCloseMock = vi.fn();
    const onSuccessMock = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <HumanDecisionModal
          isOpen={true}
          onClose={onCloseMock}
          task={mockTask}
          onSuccess={onSuccessMock}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Human Decision & Verification Gate')).toBeDefined();
    expect(screen.getByText(/Verify international export declaration/i)).toBeDefined();

    // Verify rejection requires comment
    const rejectBtn = screen.getByText('Reject & Compensate');
    fireEvent.click(rejectBtn);

    expect(
      screen.getByText(/Decision rationale comment is mandatory when rejecting a workflow step/i)
    ).toBeDefined();

    // Fill in comment
    const commentInput = screen.getByPlaceholderText(/Provide rationale, audit sign-off notes/i);
    fireEvent.change(commentInput, { target: { value: 'Export documentation missing signature' } });

    // Checklist interaction
    const checkbox = screen.getByRole('checkbox', { name: /I have verified that upstream inputs/i });
    expect(checkbox).toBeDefined();
    fireEvent.click(checkbox);
    expect(checkbox.getAttribute('data-state') === 'checked' || checkbox.getAttribute('aria-checked') === 'true').toBe(true);
  });
});
