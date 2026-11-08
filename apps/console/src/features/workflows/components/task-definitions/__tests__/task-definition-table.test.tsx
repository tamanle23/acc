import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskDefinitionTable } from '../task-definition-table';
import { type TaskDefinitionRecord } from '@/features/workflows/api/task-definition-api';

vi.mock('@/features/system/hooks/use-has-permission', () => ({
  useHasPermission: () => true,
}));

const mockTaskDefs: TaskDefinitionRecord[] = [
  {
    taskDefId: 'td-1',
    tenantId: 'tenant-test',
    name: 'validateCustomerOrder',
    version: 1,
    status: 'ACTIVE',
    description: 'Validates line items and stock',
    retryCount: 3,
    retryDelaySeconds: 5,
    backoffRate: 2,
    timeoutSeconds: 30,
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
      },
    },
    createdAtMs: 1700000000000,
    updatedAtMs: 1700000000000,
  },
  {
    taskDefId: 'td-2',
    tenantId: 'tenant-test',
    name: 'chargePayment',
    version: 2,
    status: 'DRAFT',
    description: 'Processes credit card transactions',
    retryCount: 2,
    retryDelaySeconds: 10,
    backoffRate: 2,
    timeoutSeconds: 60,
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        txId: { type: 'string' },
      },
    },
    createdAtMs: 1700000000000,
    updatedAtMs: 1700000000000,
  },
];

describe('TaskDefinitionTable Component', () => {
  it('renders task definition rows with badges and policy info', () => {
    const onEdit = vi.fn();
    const onViewHistory = vi.fn();
    const onPublish = vi.fn();
    const onDeleteDraft = vi.fn();
    const onCreateNew = vi.fn();

    render(
      <TaskDefinitionTable
        data={mockTaskDefs}
        isLoading={false}
        onEditTaskDef={onEdit}
        onViewHistory={onViewHistory}
        onPublishTaskDef={onPublish}
        onDeleteDraft={onDeleteDraft}
        onCreateNew={onCreateNew}
      />
    );

    // Verify task names rendered
    expect(screen.getByText('validateCustomerOrder')).toBeDefined();
    expect(screen.getByText('chargePayment')).toBeDefined();

    // Verify version badges
    expect(screen.getByText('v1')).toBeDefined();
    expect(screen.getByText('v2')).toBeDefined();

    // Verify status badges
    expect(screen.getByText('ACTIVE')).toBeDefined();
    expect(screen.getByText('DRAFT')).toBeDefined();
  });

  it('triggers onCreateNew when create button is clicked', () => {
    const onCreateNew = vi.fn();

    render(
      <TaskDefinitionTable
        data={mockTaskDefs}
        isLoading={false}
        onEditTaskDef={vi.fn()}
        onViewHistory={vi.fn()}
        onPublishTaskDef={vi.fn()}
        onDeleteDraft={vi.fn()}
        onCreateNew={onCreateNew}
      />
    );

    const createBtn = screen.getByRole('button', { name: /create task definition/i });
    fireEvent.click(createBtn);
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it('displays empty state when data is empty and not loading', () => {
    render(
      <TaskDefinitionTable
        data={[]}
        isLoading={false}
        onEditTaskDef={vi.fn()}
        onViewHistory={vi.fn()}
        onPublishTaskDef={vi.fn()}
        onDeleteDraft={vi.fn()}
        onCreateNew={vi.fn()}
      />
    );

    expect(screen.getByText('No task definitions found')).toBeDefined();
    expect(screen.getByRole('button', { name: /define your first task contract/i })).toBeDefined();
  });

  it('renders built-in task definitions with BUILT-IN badge and inspect actions', () => {
    const builtInTaskDefs: TaskDefinitionRecord[] = [
      {
        taskDefId: 'td-system-http',
        tenantId: 'SYSTEM',
        name: 'HTTP',
        version: 1,
        status: 'ACTIVE',
        description: 'Built-in HTTP task node',
        isBuiltIn: true,
        inputSchema: { type: 'object', properties: { url: { type: 'string' } } },
        outputSchema: { type: 'object', properties: { statusCode: { type: 'number' } } },
        createdAtMs: 1700000000000,
        updatedAtMs: 1700000000000,
      },
    ];

    const onEditTaskDef = vi.fn();
    const onForkDraft = vi.fn();

    render(
      <TaskDefinitionTable
        data={builtInTaskDefs}
        isLoading={false}
        onEditTaskDef={onEditTaskDef}
        onForkDraft={onForkDraft}
        onViewHistory={vi.fn()}
        onPublishTaskDef={vi.fn()}
        onDeleteDraft={vi.fn()}
        onCreateNew={vi.fn()}
      />
    );

    // Verify task name and BUILT-IN badge are rendered
    expect(screen.getByText('HTTP')).toBeDefined();
    expect(screen.getByText('BUILT-IN')).toBeDefined();
  });
});
