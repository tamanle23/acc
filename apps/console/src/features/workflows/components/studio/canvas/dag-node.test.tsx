import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DagWorkflowNodeComponent, areDagNodePropsEqual, type DagNodeData } from './dag-node';
import { ReactFlowProvider } from '@xyflow/react';

describe('DagWorkflowNodeComponent Unit Tests', () => {
  it('renders node details and execution status correctly', () => {
    const data: DagNodeData = {
      taskReferenceName: 'checkInventory',
      taskType: 'SIMPLE',
      label: 'Inventory Check',
      timeoutSeconds: 30,
      retryCount: 3,
      executionState: 'COMPLETED',
    };

    render(
      <ReactFlowProvider>
        <DagWorkflowNodeComponent
          id="test-node"
          type="dagNode"
          data={data}
          selected={false}
          zIndex={0}
          isConnectable={true}
          positionAbsoluteX={0}
          positionAbsoluteY={0}
          dragging={false}
        />
      </ReactFlowProvider>
    );

    expect(screen.getAllByText('Inventory Check').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('COMPLETED').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Ref:/)).toBeDefined();
    expect(screen.getByText(/checkInventory/)).toBeDefined();
  });

  it('renders switch node with condition details', () => {
    const data: DagNodeData = {
      taskReferenceName: 'routeShipping',
      taskType: 'SWITCH',
      label: 'Route Order',
      executionState: 'IN_PROGRESS',
    };

    render(
      <ReactFlowProvider>
        <DagWorkflowNodeComponent
          id="switch-node"
          type="dagNode"
          data={data}
          selected={false}
          zIndex={0}
          isConnectable={true}
          positionAbsoluteX={0}
          positionAbsoluteY={0}
          dragging={false}
        />
      </ReactFlowProvider>
    );

    expect(screen.getAllByText('Route Order').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('RUNNING')).toBeDefined();
  });

  it('renders visual diff status pills correctly for added, removed, and modified nodes', () => {
    const { rerender } = render(
      <ReactFlowProvider>
        <DagWorkflowNodeComponent
          id="diff-node"
          type="dagNode"
          data={{
            taskReferenceName: 'calculateCustomsTax',
            taskType: 'SIMPLE',
            label: 'Calculate Tax',
            diffStatus: 'added',
          }}
          selected={false}
          zIndex={0}
          isConnectable={true}
          positionAbsoluteX={0}
          positionAbsoluteY={0}
          dragging={false}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByText('added')).toBeDefined();

    rerender(
      <ReactFlowProvider>
        <DagWorkflowNodeComponent
          id="diff-node"
          type="dagNode"
          data={{
            taskReferenceName: 'calculateCustomsTax',
            taskType: 'SIMPLE',
            label: 'Calculate Tax',
            diffStatus: 'removed',
          }}
          selected={false}
          zIndex={0}
          isConnectable={true}
          positionAbsoluteX={0}
          positionAbsoluteY={0}
          dragging={false}
        />
      </ReactFlowProvider>
    );
    expect(screen.getByText('removed')).toBeDefined();

    rerender(
      <ReactFlowProvider>
        <DagWorkflowNodeComponent
          id="diff-node"
          type="dagNode"
          data={{
            taskReferenceName: 'calculateCustomsTax',
            taskType: 'SIMPLE',
            label: 'Calculate Tax',
            diffStatus: 'modified',
          }}
          selected={false}
          zIndex={0}
          isConnectable={true}
          positionAbsoluteX={0}
          positionAbsoluteY={0}
          dragging={false}
        />
      </ReactFlowProvider>
    );
    expect(screen.getByText('modified')).toBeDefined();
  });

  it('renders START and END boundary badges correctly on entry and exit nodes with directional handle constraints', () => {
    const { rerender } = render(
      <ReactFlowProvider>
        <DagWorkflowNodeComponent
          id="start-node"
          type="dagNode"
          data={{
            taskReferenceName: 'startTask',
            taskType: 'NOOP',
            label: 'Start Task',
            isStartNode: true,
            isPermanent: true,
            inputParameters: { orderId: 'ORD-1', customerId: 'CUST-2' },
          }}
          selected={false}
          zIndex={0}
          isConnectable={true}
          positionAbsoluteX={0}
          positionAbsoluteY={0}
          dragging={false}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByTestId('dag-node-start-badge-startTask')).toBeDefined();
    expect(screen.getByText('START')).toBeDefined();
    expect(screen.getByText('Workflow Input (2 params)')).toBeDefined();
    // START node only has source handle (out-degree), NO target handle (in-degree is 0)
    expect(screen.getByTestId('dag-handle-source-startTask')).toBeDefined();
    expect(screen.queryByTestId('dag-handle-target-startTask')).toBeNull();

    rerender(
      <ReactFlowProvider>
        <DagWorkflowNodeComponent
          id="end-node"
          type="dagNode"
          data={{
            taskReferenceName: 'endTask',
            taskType: 'TERMINATE',
            label: 'End Task',
            isEndNode: true,
            isPermanent: true,
            inputParameters: { result: '${task.output.data}' },
          }}
          selected={false}
          zIndex={0}
          isConnectable={true}
          positionAbsoluteX={0}
          positionAbsoluteY={0}
          dragging={false}
        />
      </ReactFlowProvider>
    );

    expect(screen.getByTestId('dag-node-end-badge-endTask')).toBeDefined();
    expect(screen.getByText('END')).toBeDefined();
    expect(screen.getByText('Workflow Output (1 mappings)')).toBeDefined();
    // END node only has target handle (in-degree), NO source handle (out-degree is 0)
    expect(screen.getByTestId('dag-handle-target-endTask')).toBeDefined();
    expect(screen.queryByTestId('dag-handle-source-endTask')).toBeNull();
  });

  it('adheres to WCAG 2.2 AA accessibility with keyboard navigation and ARIA labels', () => {
    let inspectedRef: string | null = null;
    const data: DagNodeData = {
      taskReferenceName: 'validatePayment',
      taskType: 'SIMPLE',
      label: 'Validate Payment',
      executionState: 'IN_PROGRESS',
      onInspectTask: (ref) => {
        inspectedRef = ref;
      },
    };

    render(
      <ReactFlowProvider>
        <DagWorkflowNodeComponent
          id="access-node"
          type="dagNode"
          data={data}
          selected={true}
          zIndex={0}
          isConnectable={true}
          positionAbsoluteX={0}
          positionAbsoluteY={0}
          dragging={false}
        />
      </ReactFlowProvider>
    );

    const nodeBtn = screen.getByRole('button', { name: /Validate Payment, status IN_PROGRESS/i });
    expect(nodeBtn).toBeDefined();
    expect(nodeBtn.getAttribute('tabindex')).toBe('0');
    expect(nodeBtn.getAttribute('aria-selected')).toBe('true');

    // Test Enter key activates task inspector
    nodeBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(inspectedRef).toBe('validatePayment');
  });

  it('correctly evaluates areDagNodePropsEqual to isolate re-renders', () => {
    const baseNodeProps: any = {
      id: 'node-1',
      selected: false,
      data: {
        taskReferenceName: 'step1',
        taskType: 'SIMPLE',
        label: 'Step 1',
        executionState: 'PENDING',
      },
    };

    const identicalProps: any = {
      id: 'node-1',
      selected: false,
      data: {
        taskReferenceName: 'step1',
        taskType: 'SIMPLE',
        label: 'Step 1',
        executionState: 'PENDING',
      },
    };

    expect(areDagNodePropsEqual(baseNodeProps, identicalProps)).toBe(true);

    const changedStateProps: any = {
      id: 'node-1',
      selected: false,
      data: {
        ...baseNodeProps.data,
        executionState: 'COMPLETED',
      },
    };
    expect(areDagNodePropsEqual(baseNodeProps, changedStateProps)).toBe(false);

    const changedSelectionProps: any = {
      ...baseNodeProps,
      selected: true,
    };
    expect(areDagNodePropsEqual(baseNodeProps, changedSelectionProps)).toBe(false);
  });
});
