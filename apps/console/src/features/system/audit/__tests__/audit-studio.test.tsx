import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuditStudioTable } from '../audit-studio-table';
import * as auditApi from '../../api/use-system-audit';

vi.mock('../../api/use-system-audit', () => ({
  useSystemAuditRecords: vi.fn(() => ({
    data: {
      content: [
        {
          id: 101,
          tenantId: 'SYSTEM',
          recordId: 1,
          entityTypeId: 10,
          operation: 'CREATE',
          actor: 'custodian_root',
          version: 1,
          oldAttributes: null,
          newAttributes: { name: 'Customer Acme' },
          delta: { name: { old: null, new: 'Customer Acme' } },
          prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
          currentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          createdAt: '2026-10-25T12:00:00Z',
        },
      ],
      totalElements: 1,
      totalPages: 1,
      page: 0,
      size: 10,
    },
    isLoading: false,
    refetch: vi.fn(),
  })),
  useVerifyAuditChain: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    data: null,
  })),
  useExportCompliancePackage: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

describe('AuditStudioTable', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders cryptographic audit studio header and records in DataTable', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuditStudioTable />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Cryptographic Forward-Hash Ledger/i)).toBeTruthy();
    expect(screen.getByText(/Active SHA-256 Ledger/i)).toBeTruthy();
    expect(screen.getByText('#101')).toBeTruthy();
    expect(screen.getByText('custodian_root')).toBeTruthy();
    expect(screen.getByText(/Verify Chain Integrity/i)).toBeTruthy();
    expect(screen.getByText(/Export Evidence/i)).toBeTruthy();
  });

  it('opens diff inspection modal when clicking Diff button', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuditStudioTable />
      </QueryClientProvider>
    );

    const diffButton = screen.getByRole('button', { name: /Diff/i });
    fireEvent.click(diffButton);

    expect(screen.getByText(/Audit Block #101 Inspection/i)).toBeTruthy();
    expect(screen.getByText(/Attribute Delta/i)).toBeTruthy();
  });
});
