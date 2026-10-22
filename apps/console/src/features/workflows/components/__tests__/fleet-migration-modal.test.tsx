import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FleetMigrationModal } from '../migration/fleet-migration-modal';
import * as workflowApi from '@/features/workflows/api/workflow-api';

vi.mock('@/features/workflows/api/workflow-api', () => ({
  useWorkflowVersions: vi.fn(),
  useFleetMigrationPreview: vi.fn(),
  useFleetBatchMigrate: vi.fn(),
}));

describe('FleetMigrationModal Component', () => {
  const mockOnClose = vi.fn();
  const mockBatchMigrate = vi.fn().mockResolvedValue({ migrated: 1, failed: 0 });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(workflowApi.useWorkflowVersions).mockReturnValue({
      data: [
        { version: 1, name: 'Order Flow v1', status: 'ACTIVE', definition: {} } as any,
        { version: 2, name: 'Order Flow v2', status: 'ACTIVE', definition: {} } as any,
      ],
    } as any);

    vi.mocked(workflowApi.useFleetMigrationPreview).mockReturnValue({
      data: {
        workflowKey: 'order-flow',
        targetVersion: 2,
        summary: {
          total: 3,
          fullyCompatible: 1,
          requiresReview: 1,
          incompatible: 1,
        },
        items: [
          {
            workflowId: 'wf_exec_001_safe',
            currentVersion: 1,
            status: 'RUNNING',
            tier: 'FULLY_COMPATIBLE',
            compatible: true,
            completedTasks: ['step1'],
            activeTasks: ['step2'],
            warnings: [],
            issues: [],
          },
          {
            workflowId: 'wf_exec_002_review',
            currentVersion: 1,
            status: 'RUNNING',
            tier: 'CONDITIONAL_REQUIRES_MANUAL_REVIEW',
            compatible: true,
            completedTasks: ['step1'],
            activeTasks: ['step2'],
            warnings: ['Parameter binding added'],
            issues: [],
          },
          {
            workflowId: 'wf_exec_003_blocked',
            currentVersion: 1,
            status: 'COMPLETED',
            tier: 'INCOMPATIBLE_BLOCK',
            compatible: false,
            completedTasks: ['step1', 'step2'],
            activeTasks: [],
            warnings: [],
            issues: ['Cannot hot-migrate execution in terminal state'],
          },
        ],
      },
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(workflowApi.useFleetBatchMigrate).mockReturnValue({
      mutateAsync: mockBatchMigrate,
      isPending: false,
    } as any);
  });

  it('renders modal with 3-tier metrics and execution list', () => {
    render(
      <FleetMigrationModal
        isOpen={true}
        onClose={mockOnClose}
        workflowKey="order-flow"
        workflowName="Order Flow"
        currentVersion={1}
      />
    );

    expect(screen.getByText('Fleet In-Flight Hot Migration')).toBeDefined();
    expect(screen.getByText('Order Flow (order-flow)')).toBeDefined();
    expect(screen.getByText('Quiescence Guard')).toBeDefined();

    // Verify 3-tier counter metrics
    expect(screen.getByText('Total In-Flight')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getAllByText('Compatible').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Requires Review').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Incompatible').length).toBeGreaterThan(0);

    // Verify execution rows
    expect(screen.getByText('wf_exec_001_safe')).toBeDefined();
    expect(screen.getByText('wf_exec_002_review')).toBeDefined();
    expect(screen.getByText('wf_exec_003_blocked')).toBeDefined();
  });

  it('triggers batch migration for compatible executions with reaffirmation', async () => {
    render(
      <FleetMigrationModal
        isOpen={true}
        onClose={mockOnClose}
        workflowKey="order-flow"
        workflowName="Order Flow"
        currentVersion={1}
      />
    );

    const migrateAllBtn = screen.getByRole('button', { name: /Migrate All Compatible/i });
    expect(migrateAllBtn).toBeDefined();

    // Clicking initial button opens reaffirm dialog
    fireEvent.click(migrateAllBtn);

    expect(screen.getByText('Reaffirm Fleet Hot Migration')).toBeDefined();

    // Clicking reaffirm confirm button triggers batch migration
    const reaffirmBtn = screen.getByRole('button', { name: /Yes, Reaffirm & Migrate All/i });
    fireEvent.click(reaffirmBtn);

    await waitFor(() => {
      expect(mockBatchMigrate).toHaveBeenCalledWith({
        workflowKey: 'order-flow',
        targetVersion: 2,
        autoMigrateCompatibleOnly: true,
      });
    });
  });
});
