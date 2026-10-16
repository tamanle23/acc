import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecordAuditHistoryDrawer } from './record-audit-history-drawer';
import * as metadataApi from '../../api/metadata-api';
import { useAuthStore } from '@/stores/auth-store';
import { useSandboxStore } from '@/core/sandbox/store/sandbox-store';
import type { EntityRecord, RecordAuditLog } from '../../api/types';

const mockRecord: EntityRecord = {
  id: 101,
  entityTypeId: 1,
  tenantId: 'tenant-acme',
  version: 3,
  attributes: {
    status: 'ACTIVE',
    credit_limit: 150000,
    company_name: 'Acme Global Corp',
  },
  createdDate: '2026-10-10T10:00:00Z',
  updatedDate: '2026-10-16T12:00:00Z',
};

const mockAuditLogs: RecordAuditLog[] = [
  {
    id: 301,
    tenantId: 'tenant-acme',
    entityTypeId: 1,
    recordId: 101,
    version: 3,
    operation: 'UPDATE',
    oldAttributes: { status: 'ACTIVE', credit_limit: 100000 },
    newAttributes: { status: 'ACTIVE', credit_limit: 150000 },
    delta: { credit_limit: { old: 100000, new: 150000 } },
    changedBy: 'finance_lead@acme.com',
    createdAt: '2026-10-16T12:00:00Z',
  },
  {
    id: 201,
    tenantId: 'tenant-acme',
    entityTypeId: 1,
    recordId: 101,
    version: 2,
    operation: 'PATCH',
    oldAttributes: { status: 'DRAFT', credit_limit: 100000 },
    newAttributes: { status: 'ACTIVE', credit_limit: 100000 },
    delta: { status: { old: 'DRAFT', new: 'ACTIVE' } },
    changedBy: 'manager@acme.com',
    createdAt: '2026-10-12T10:00:00Z',
  },
  {
    id: 101,
    tenantId: 'tenant-acme',
    entityTypeId: 1,
    recordId: 101,
    version: 1,
    operation: 'CREATE',
    oldAttributes: null,
    newAttributes: { status: 'DRAFT', credit_limit: 100000, company_name: 'Acme Global Corp' },
    delta: null,
    changedBy: 'creator@acme.com',
    createdAt: '2026-10-10T10:00:00Z',
  },
];

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('RecordAuditHistoryDrawer', () => {
  const mockMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(metadataApi, 'useRecordAuditLogs').mockReturnValue({
      data: mockAuditLogs,
      isLoading: false,
      isError: false,
    } as any);

    vi.spyOn(metadataApi, 'usePreviewRestoreRecord').mockReturnValue({
      data: {
        recordId: 101,
        entityTypeId: 1,
        targetAuditLogId: 201,
        targetVersion: 2,
        currentVersion: 3,
        nextVersion: 4,
        currentAttributes: mockRecord.attributes,
        restoredAttributes: { status: 'ACTIVE', credit_limit: 100000 },
        delta: { credit_limit: { old: 150000, new: 100000 } },
      },
      isLoading: false,
    } as any);

    mockMutateAsync.mockResolvedValue({
      ...mockRecord,
      version: 4,
    });

    vi.spyOn(metadataApi, 'useRestoreRecordVersion').mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);
  });

  it('renders audit ledger timeline and version history correctly', () => {
    useAuthStore.setState({
      auth: {
        user: { accountNo: '1', email: 'user@unipost.io', role: ['ROLE_USER'], exp: 0 },
        accessToken: 'token',
        setUser: vi.fn(),
        setAccessToken: vi.fn(),
        resetAccessToken: vi.fn(),
        reset: vi.fn(),
      },
    });
    useSandboxStore.setState({ activePersonaId: 'user' });

    renderWithQueryClient(
      <RecordAuditHistoryDrawer
        record={mockRecord}
        entityTypeId={1}
        open={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Record Audit Ledger/i)).toBeDefined();
    expect(screen.getByText('Current: v3')).toBeDefined();
    expect(screen.getByText('v3')).toBeDefined();
    expect(screen.getByText('v2')).toBeDefined();
    expect(screen.getByText('v1')).toBeDefined();
    expect(screen.getByText('finance_lead@acme.com')).toBeDefined();
    expect(screen.getByText('credit_limit:')).toBeDefined();
  });

  it('keeps restore button locked and disabled for non-sovereign standard users', () => {
    useAuthStore.setState({
      auth: {
        user: { accountNo: '1', email: 'user@unipost.io', role: ['ROLE_USER'], exp: 0 },
        accessToken: 'token',
        setUser: vi.fn(),
        setAccessToken: vi.fn(),
        resetAccessToken: vi.fn(),
        reset: vi.fn(),
      },
    });
    useSandboxStore.setState({ activePersonaId: 'user' });

    renderWithQueryClient(
      <RecordAuditHistoryDrawer
        record={mockRecord}
        entityTypeId={1}
        open={true}
        onClose={vi.fn()}
      />
    );

    const lockedButtons = screen.getAllByText('Restore (Locked)');
    expect(lockedButtons.length).toBeGreaterThan(0);
    expect((lockedButtons[0].closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('unlocks Preview Restore button for Sovereign Root Custodians and opens confirmation preview', async () => {
    useAuthStore.setState({
      auth: {
        user: {
          accountNo: '1',
          email: 'custodian@unipost.io',
          role: ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_SYSTEM_CUSTODIAN'],
          exp: 0,
        },
        accessToken: 'token',
        setUser: vi.fn(),
        setAccessToken: vi.fn(),
        resetAccessToken: vi.fn(),
        reset: vi.fn(),
      },
    });
    useSandboxStore.setState({ activePersonaId: 'system' });

    renderWithQueryClient(
      <RecordAuditHistoryDrawer
        record={mockRecord}
        entityTypeId={1}
        open={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Sovereign Root Custodian Session Active')).toBeDefined();

    const previewButtons = screen.getAllByText('Preview Restore');
    expect(previewButtons.length).toBeGreaterThan(0);

    const btn = previewButtons[0].closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);

    fireEvent.click(btn);

    expect(screen.getByText('Confirm Sovereign Record Version Restore')).toBeDefined();
    expect(screen.getByText('Target Version')).toBeDefined();
    expect(screen.getByText('Next Version')).toBeDefined();

    const confirmBtn = screen.getByText(/Execute Sovereign Restore/i);
    expect(confirmBtn).toBeDefined();

    fireEvent.click(confirmBtn);
    expect(mockMutateAsync).toHaveBeenCalledWith({
      recordId: 101,
      auditLogId: 201,
    });
  });
});
