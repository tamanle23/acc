import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HotMigrationModal } from '../hot-migration-modal';

// Mock workflow API queries
const mockDryRun = vi.fn().mockResolvedValue({
  compatible: true,
  sourceVersion: 'v1',
  targetVersion: 'v2',
  completedTasksPreserved: ['checkInventory'],
  activeFrontierTasks: ['verifyFraud'],
  addedDownstreamTasks: ['calculateCustomsTax'],
  removedTasks: [],
  issues: [],
});

const mockMigrate = vi.fn().mockResolvedValue({
  workflowId: 'wf-101',
  version: 2,
});

vi.mock('@/features/workflows/api/workflow-api', () => ({
  useWorkflowVersions: () => ({
    data: [
      {
        definitionId: 'wf_v1',
        workflowKey: 'order-flow',
        version: 1,
        status: 'ACTIVE',
        name: 'Order Flow v1',
        definition: { workflowKey: 'order-flow', version: 1, tasks: [] },
      },
      {
        definitionId: 'wf_v2',
        workflowKey: 'order-flow',
        version: 2,
        status: 'DRAFT',
        name: 'Order Flow v2',
        definition: { workflowKey: 'order-flow', version: 2, tasks: [] },
      },
    ],
  }),
  useMigrationDryRun: () => ({
    mutateAsync: mockDryRun,
    isPending: false,
  }),
  useMigrateExecution: () => ({
    mutateAsync: mockMigrate,
    isPending: false,
  }),
  useVerifyAuditLedger: () => ({
    data: {
      verified: true,
      totalEvents: 4,
      corruptedAtSequence: null,
      details: 'Chain cryptographically intact (4 events verified)',
    },
  }),
}));

describe('HotMigrationModal Component Tests', () => {
  it('renders modal with cryptographic audit integrity badge and version options', () => {
    render(
      <HotMigrationModal
        isOpen={true}
        onClose={vi.fn()}
        workflowKey="order-flow"
        executionId="wf-101"
        currentVersion={1}
      />
    );

    expect(screen.getByText('Policy B: In-Flight Hot Migration')).toBeDefined();
    expect(screen.getByText(/Cryptographically Verified/)).toBeDefined();
    expect(screen.getByText('v1')).toBeDefined();
    expect(screen.getByText('Dry-Run Compatibility Check')).toBeDefined();
  });

  it('runs topological dry-run check and displays compatibility report', async () => {
    render(
      <HotMigrationModal
        isOpen={true}
        onClose={vi.fn()}
        workflowKey="order-flow"
        executionId="wf-101"
        currentVersion={1}
      />
    );

    const checkBtn = screen.getByText('Dry-Run Compatibility Check');
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(mockDryRun).toHaveBeenCalled();
      expect(screen.getByText('Compatible')).toBeDefined();
      expect(screen.getByText(/Preserved Tasks/)).toBeDefined();
      expect(screen.getByText(/Commit Hot Migration to v2/)).toBeDefined();
    });
  });
});
