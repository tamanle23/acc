import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DagPropertyInspector } from './dag-property-inspector';
import type { DagNodeData } from './dag-node';

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
    expect(screen.getByText('Workflow Input Parameters & Default Schema')).toBeDefined();
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
});
