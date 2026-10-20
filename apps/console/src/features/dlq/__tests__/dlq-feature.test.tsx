import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DlqTable } from '../components/dlq-table';
import { DlqInspectorSheet } from '../components/dlq-inspector-sheet';
import { DlqFeature } from '../index';
import type { TaskDlqRecordDto } from '@unipost/client';
import * as dlqHooks from '../hooks/use-dlq';
import * as permissionsHook from '@/features/spring-auth/hooks/use-permissions';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/system/dlq' }),
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  };
});

const mockDlqRecord: TaskDlqRecordDto = {
  dlqId: 'dlq_test_001',
  tenantId: 'tenant_default',
  workspaceId: 'workspace_main',
  taskId: 'task_exec_fail_99',
  workflowId: 'wf_exec_001',
  taskType: 'payment-charge-v2',
  domain: 'finance',
  status: 'ISOLATED',
  errorMessage: 'HTTP 504 Gateway Timeout from stripe-connect endpoint',
  errorStacktrace: 'java.net.SocketTimeoutException: Read timed out\n  at com.unipost.worker.PaymentWorker.charge()',
  payloadSnapshot: {
    amount: 150000,
    currency: 'VND',
    customerEmail: 'customer@example.com',
  },
  retryCount: 3,
  isolatedAtMs: Date.now() - 3600000,
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

describe('Dead-Letter Queue (DLQ) Feature', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    queryClient = createTestQueryClient();
    vi.clearAllMocks();

    vi.spyOn(permissionsHook, 'usePermissions').mockReturnValue({
      user: null,
      roles: ['ROLE_SYSTEM_CUSTODIAN'],
      currentTenantId: 'SYSTEM',
      isSovereignCustodian: true,
      isAdmin: true,
      isOperator: true,
      canManageSchema: true,
      canMutateRecords: true,
    });
  });

  it('renders task details, status, and failure reason in DlqTable', () => {
    const onInspectMock = vi.fn();
    const onReplayMock = vi.fn();
    const onDiscardMock = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <DlqTable
          records={[mockDlqRecord]}
          onInspect={onInspectMock}
          onReplay={onReplayMock}
          onDiscard={onDiscardMock}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('task_exec_fail_99')).toBeDefined();
    expect(screen.getByText('wf_exec_001')).toBeDefined();
    expect(screen.getByText('payment-charge-v2')).toBeDefined();
    expect(screen.getByText(/HTTP 504 Gateway Timeout/i)).toBeDefined();
    expect(screen.getByText('3 retries')).toBeDefined();
  });

  it('renders DlqInspectorSheet with error stacktrace, payload snapshot, and supports replay with overrides', async () => {
    const onOpenChangeMock = vi.fn();
    const onReplayMock = vi.fn();
    const onDiscardMock = vi.fn();

    render(
      <DlqInspectorSheet
        record={mockDlqRecord}
        open={true}
        onOpenChange={onOpenChangeMock}
        onReplay={onReplayMock}
        onDiscard={onDiscardMock}
      />
    );

    expect(screen.getByText('Dead-Letter Queue Inspector')).toBeDefined();
    expect(screen.getByText(/HTTP 504 Gateway Timeout/i)).toBeDefined();
    expect(screen.getByText(/SocketTimeoutException/i)).toBeDefined();

    // Test JSON override valid replay with payload snapshot
    const replayBtn = screen.getByRole('button', { name: /Replay Task/i });
    fireEvent.click(replayBtn);

    expect(onReplayMock).toHaveBeenCalledWith(mockDlqRecord, mockDlqRecord.payloadSnapshot);
    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it('renders DlqFeature dashboard with Sovereign Platform Root badge, metric cards and integrated table', () => {
    vi.spyOn(dlqHooks, 'useDlqQuery').mockReturnValue({
      data: [mockDlqRecord],
      isLoading: false,
      isRefetching: false,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(dlqHooks, 'useReplayDlqMutation').mockReturnValue({
      mutate: vi.fn(),
    } as any);

    vi.spyOn(dlqHooks, 'useDiscardDlqMutation').mockReturnValue({
      mutate: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>
          <DlqFeature />
        </SidebarProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('Sovereign Platform Root')).toBeDefined();
    expect(screen.getByText('Dead-Letter Queue (DLQ)')).toBeDefined();
    expect(screen.getByText('Isolated Tasks')).toBeDefined();
    expect(screen.getByText('Replayed Recoveries')).toBeDefined();
    expect(screen.getByText('Discarded Tasks')).toBeDefined();
    expect(screen.getByText('task_exec_fail_99')).toBeDefined();
  });

  it('blocks non-sovereign tenants with 403 Forbidden message', () => {
    vi.spyOn(permissionsHook, 'usePermissions').mockReturnValue({
      user: null,
      roles: ['ROLE_USER'],
      currentTenantId: 'tenant-acme',
      isSovereignCustodian: false,
      isAdmin: false,
      isOperator: false,
      canManageSchema: false,
      canMutateRecords: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>
          <DlqFeature />
        </SidebarProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText(/403 Forbidden: Sovereign Custody Restricted/i)).toBeDefined();
  });
});
