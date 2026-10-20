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
});
