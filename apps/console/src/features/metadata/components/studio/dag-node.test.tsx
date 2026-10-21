import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DagWorkflowNodeComponent, type DagNodeData } from './dag-node';
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

    expect(screen.getByText('Inventory Check')).toBeDefined();
    expect(screen.getByText('COMPLETED')).toBeDefined();
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

    expect(screen.getByText('Route Order')).toBeDefined();
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

  it('renders START and END boundary badges correctly on entry and exit nodes', () => {
    const { rerender } = render(
      <ReactFlowProvider>
        <DagWorkflowNodeComponent
          id="start-node"
          type="dagNode"
          data={{
            taskReferenceName: 'startTask',
            taskType: 'SIMPLE',
            label: 'Start Task',
            isStartNode: true,
            isPermanent: true,
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
  });
});
