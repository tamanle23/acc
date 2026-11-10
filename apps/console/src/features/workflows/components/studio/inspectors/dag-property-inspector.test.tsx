import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DagPropertyInspector } from './dag-property-inspector';
import type { DagNodeData } from '../canvas/dag-node';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('DagPropertyInspector Drawer', () => {
  const mockNodeData: DagNodeData = {
    taskReferenceName: 'checkInventory',
    taskType: 'SIMPLE',
    label: 'Check Inventory',
    domain: 'inventory',
    description: 'Inventory check service',
    timeoutSeconds: 30,
    retryCount: 3,
    retryDelaySeconds: 2,
    backoffRate: 2.0,
    inputParameters: {
      orderId: '${workflow.input.orderId}',
    },
    compensateHandlerRef: 'cancelReservation',
  };

  it('renders node properties when open', () => {
    const handleUpdate = vi.fn();
    const handleOpenChange = vi.fn();

    renderWithClient(
      <DagPropertyInspector
        nodeId="node-checkInventory"
        nodeData={mockNodeData}
        open={true}
        onOpenChange={handleOpenChange}
        onUpdateNodeData={handleUpdate}
        availableTaskRefs={['checkInventory', 'routeShipping']}
      />
    );

    expect(screen.getByText('Node Inspector')).toBeDefined();
    expect(screen.getByDisplayValue('checkInventory')).toBeDefined();
    expect(screen.getByDisplayValue('Check Inventory')).toBeDefined();
    expect(screen.getByDisplayValue('inventory')).toBeDefined();
    expect(screen.getByDisplayValue('Inventory check service')).toBeDefined();
  });

  it('invokes update callback when editing general properties', () => {
    const handleUpdate = vi.fn();

    renderWithClient(
      <DagPropertyInspector
        nodeId="node-checkInventory"
        nodeData={mockNodeData}
        open={true}
        onOpenChange={vi.fn()}
        onUpdateNodeData={handleUpdate}
        availableTaskRefs={['checkInventory']}
      />
    );

    const labelInput = screen.getByDisplayValue('Check Inventory');
    fireEvent.change(labelInput, { target: { value: 'Inventory Check Pro' } });

    expect(handleUpdate).toHaveBeenCalledWith(
      'node-checkInventory',
      expect.objectContaining({ label: 'Inventory Check Pro' })
    );

    const domainInput = screen.getByDisplayValue('inventory');
    fireEvent.change(domainInput, { target: { value: 'warehouse' } });

    expect(handleUpdate).toHaveBeenCalledWith(
      'node-checkInventory',
      expect.objectContaining({ domain: 'warehouse' })
    );
  });

  it('renders dedicated pure Workflow Start input inspector for START nodes', () => {
    const handleUpdate = vi.fn();
    const startNodeData: DagNodeData = {
      taskReferenceName: 'workflow_start',
      taskType: 'NOOP',
      label: 'Workflow Start',
      isStartNode: true,
      isPermanent: true,
      inputParameters: {
        orderId: 'ORD-9821',
      },
    };

    renderWithClient(
      <DagPropertyInspector
        nodeId="node-start"
        nodeData={startNodeData}
        open={true}
        onOpenChange={vi.fn()}
        onUpdateNodeData={handleUpdate}
        availableTaskRefs={['workflow_start', 'checkInventory']}
      />
    );

    expect(screen.getByText('Workflow Start')).toBeDefined();
    expect(screen.getByText('Pure Conventional Start Node')).toBeDefined();
    expect(screen.getByText('Trigger Input Schema (Draft 7)')).toBeDefined();
    // Worker and Policy tabs should not exist on pure start node
    expect(screen.queryByText('Bind to Registered SIMPLE Worker')).toBeNull();
    expect(screen.queryByText('Policies')).toBeNull();
  });

  it('renders dedicated pure Workflow End output inspector for END nodes', () => {
    const handleUpdate = vi.fn();
    const endNodeData: DagNodeData = {
      taskReferenceName: 'workflow_end',
      taskType: 'TERMINATE',
      label: 'Workflow End',
      isEndNode: true,
      isPermanent: true,
      inputParameters: {
        status: 'FULFILLED',
      },
      terminateParams: {
        terminationStatus: 'COMPLETED',
        terminationReason: 'Success',
      },
    };

    renderWithClient(
      <DagPropertyInspector
        nodeId="node-end"
        nodeData={endNodeData}
        open={true}
        onOpenChange={vi.fn()}
        onUpdateNodeData={handleUpdate}
        availableTaskRefs={['workflow_start', 'checkInventory', 'workflow_end']}
      />
    );

    expect(screen.getByText('Workflow End')).toBeDefined();
    expect(screen.getByText('Pure Conventional End Node')).toBeDefined();
    expect(screen.getByText('Workflow Output Payload Mapping')).toBeDefined();
    expect(screen.getByText('Termination Status')).toBeDefined();
    // Worker and Policy tabs should not exist on pure end node
    expect(screen.queryByText('Bind to Registered SIMPLE Worker')).toBeNull();
    expect(screen.queryByText('Policies')).toBeNull();
  });

  it('runs isolated sandbox step test in Data tab payloads view', () => {
    const nodeData: DagNodeData = {
      taskReferenceName: 'sendConfirmation',
      taskType: 'SIMPLE',
      label: 'Send Confirmation',
      inputParameters: {
        orderId: '${workflow.input.orderId}',
      },
      mockOutputPayload: {
        sent: true,
        messageId: 'msg-9921',
      },
    };

    renderWithClient(
      <DagPropertyInspector
        nodeId="node-send"
        nodeData={nodeData}
        open={true}
        onOpenChange={vi.fn()}
        onUpdateNodeData={vi.fn()}
        availableTaskRefs={['start', 'sendConfirmation']}
        defaultTab="params"
      />
    );

    // Switch to Payloads sub-tab
    fireEvent.click(screen.getByTestId('dag-inspector-tab-payloads'));

    const testStepBtn = screen.getByTestId('property-inspector-test-step-btn');
    expect(testStepBtn).toBeDefined();

    fireEvent.click(testStepBtn);

    const resultBox = screen.getByTestId('property-inspector-step-test-result');
    expect(resultBox).toBeDefined();
    expect(resultBox.textContent).toContain('COMPLETED');
    expect(resultBox.textContent).toContain('msg-9921');
  });

  it('infers Draft 7 input schema on Start Node when clicking infer button', () => {
    const handleUpdate = vi.fn();
    const startNodeData: DagNodeData = {
      taskReferenceName: 'workflow_start',
      taskType: 'START_WORKFLOW',
      label: 'Workflow Start',
      isStartNode: true,
      inputParameters: {
        orderId: 'ORD-101',
        amount: 250,
      },
    };

    renderWithClient(
      <DagPropertyInspector
        nodeId="start-node"
        nodeData={startNodeData}
        open={true}
        onOpenChange={vi.fn()}
        onUpdateNodeData={handleUpdate}
        availableTaskRefs={['workflow_start']}
      />
    );

    const inferBtn = screen.getByTestId('start-infer-schema-btn');
    expect(inferBtn).toBeDefined();
    fireEvent.click(inferBtn);

    expect(handleUpdate).toHaveBeenCalledWith(
      'start-node',
      expect.objectContaining({
        declaredOutputSchema: expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({
            orderId: { type: 'string' },
            amount: { type: 'integer' },
          }),
          required: ['orderId', 'amount'],
          additionalProperties: false,
        }),
      })
    );
  });

  it('infers Draft 7 output schema on End Node when clicking infer button', () => {
    const handleUpdate = vi.fn();
    const endNodeData: DagNodeData = {
      taskReferenceName: 'workflow_end',
      taskType: 'END_WORKFLOW',
      label: 'Workflow End',
      isEndNode: true,
      inputParameters: {
        status: '${task.output.status}',
        total: 100,
      },
    };

    renderWithClient(
      <DagPropertyInspector
        nodeId="end-node"
        nodeData={endNodeData}
        open={true}
        onOpenChange={vi.fn()}
        onUpdateNodeData={handleUpdate}
        availableTaskRefs={['task', 'workflow_end']}
      />
    );

    const inferBtn = screen.getByTestId('end-infer-schema-btn');
    expect(inferBtn).toBeDefined();
    fireEvent.click(inferBtn);

    expect(handleUpdate).toHaveBeenCalledWith(
      'end-node',
      expect.objectContaining({
        declaredOutputSchema: expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({
            status: { type: 'string' },
            total: { type: 'integer' },
          }),
          required: ['status', 'total'],
          additionalProperties: false,
        }),
      })
    );
  });

  it('renders Task Definition banner and upgrade trigger when taskDefName is present', () => {
    const handleUpgrade = vi.fn();
    const customTaskData: DagNodeData = {
      taskReferenceName: 'validateOrderTask',
      taskType: 'SIMPLE',
      taskDefName: 'validateOrder',
      taskDefVersion: 1,
      latestTaskDefVersion: 2,
      onUpgradeTaskDef: handleUpgrade,
      label: 'Validate Order',
    };

    renderWithClient(
      <DagPropertyInspector
        nodeId="node-validate"
        nodeData={customTaskData}
        open={true}
        onOpenChange={vi.fn()}
        onUpdateNodeData={vi.fn()}
        availableTaskRefs={['validateOrderTask']}
      />
    );

    expect(screen.getByTestId('task-def-banner')).toBeDefined();
    expect(screen.getByText('Task Definition: validateOrder')).toBeDefined();
    expect(screen.getByText('v1')).toBeDefined();
    expect(screen.getByText(/Newer version/)).toBeDefined();

    const upgradeBtn = screen.getByTestId('upgrade-task-def-btn');
    fireEvent.click(upgradeBtn);
    expect(handleUpgrade).toHaveBeenCalledWith('validateOrderTask');
  });

  it('renders dynamic contract parameter inputs and updates node input parameters', () => {
    const handleUpdate = vi.fn();
    const customTaskData: DagNodeData = {
      taskReferenceName: 'validateOrderTask',
      taskType: 'SIMPLE',
      taskDefName: 'validateOrder',
      inputSchema: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'Unique order identifier' },
          customerId: { type: 'string', description: 'Target customer ID' },
        },
        required: ['orderId'],
      },
      inputParameters: {},
    };

    renderWithClient(
      <DagPropertyInspector
        nodeId="node-validate"
        nodeData={customTaskData}
        open={true}
        defaultTab="params"
        onOpenChange={vi.fn()}
        onUpdateNodeData={handleUpdate}
        availableTaskRefs={['validateOrderTask']}
      />
    );

    expect(screen.getByText('Contract Parameters Form')).toBeDefined();
    const orderInput = screen.getByTestId('schema-param-input-orderId');
    expect(orderInput).toBeDefined();

    fireEvent.change(orderInput, { target: { value: 'ORD-999' } });
    expect(handleUpdate).toHaveBeenCalledWith(
      'node-validate',
      expect.objectContaining({
        inputParameters: expect.objectContaining({
          orderId: 'ORD-999',
        }),
      })
    );
  });
});
