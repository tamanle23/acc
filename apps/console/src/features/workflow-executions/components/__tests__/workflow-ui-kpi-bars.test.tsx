import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { WorkflowExecutionsKpiBar } from '@/features/workflow-executions/components/workflow-executions-kpi-bar';
import { WorkflowCatalogKpiBar } from '@/features/workflows/components/catalog/workflow-catalog-kpi-bar';
import { type WorkflowExecution } from '@/features/workflow-executions/schema';
import { type WorkflowDefinitionSummary } from '@/features/workflows/api/workflow-api';

describe('Workflow & Executions KPI Bars UI Telemetry', () => {
  it('renders execution KPI metrics accurately', () => {
    const mockExecutions: WorkflowExecution[] = [
      {
        executionId: 'exec-1',
        workflowKey: 'order_processing',
        status: 'IN_PROGRESS',
        startTime: '2026-10-24T10:00:00Z',
        durationMs: 400,
        leaseOwner: 'worker-node-1',
      },
      {
        executionId: 'exec-2',
        workflowKey: 'order_processing',
        status: 'COMPLETED',
        startTime: '2026-10-24T09:00:00Z',
        durationMs: 200,
        leaseOwner: 'worker-node-2',
      },
      {
        executionId: 'exec-3',
        workflowKey: 'notification_dispatcher',
        status: 'FAILED',
        startTime: '2026-10-24T08:00:00Z',
        durationMs: 600,
        leaseOwner: 'worker-node-1',
      },
    ];

    render(<WorkflowExecutionsKpiBar executions={mockExecutions} />);

    expect(screen.getByTestId('workflow-executions-kpi-bar')).toBeDefined();
    expect(screen.getByText('In-Flight Units')).toBeDefined();
    expect(screen.getByText('Reliability SLA')).toBeDefined();
    expect(screen.getByText('Avg Duration')).toBeDefined();
    expect(screen.getByText('Worker Nodes')).toBeDefined();
    expect(screen.getByText(/50/)).toBeDefined();
  });

  it('renders workflow catalog KPI metrics accurately', () => {
    const mockDefinitions: WorkflowDefinitionSummary[] = [
      {
        workflowKey: 'order-pipeline',
        name: 'Order Pipeline',
        version: 2,
        status: 'ACTIVE',
        tasks: [
          { taskId: 't1', taskType: 'HTTP', name: 'HTTP Task' },
          { taskId: 't2', taskType: 'TRANSFORM', name: 'Transform Task' },
        ],
      },
      {
        workflowKey: 'inventory-sync',
        name: 'Inventory Sync',
        version: 1,
        status: 'DISABLED',
        tasks: [{ taskId: 't3', taskType: 'DATABASE', name: 'DB Task' }],
      },
    ];

    render(<WorkflowCatalogKpiBar definitions={mockDefinitions} />);

    expect(screen.getByTestId('workflow-catalog-kpi-bar')).toBeDefined();
    expect(screen.getByText('Active Workflows')).toBeDefined();
    expect(screen.getByText('DAG Topology Nodes')).toBeDefined();
    expect(screen.getByText('Fleet Domains')).toBeDefined();
    expect(screen.getByText('Draft / Disabled')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined(); // 2 + 1 tasks
  });
});
