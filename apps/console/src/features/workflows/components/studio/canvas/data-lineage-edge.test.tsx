import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { buildDataLineageEdges, DataLineageEdgeComponent } from './data-lineage-edge';
import { type Node } from '@xyflow/react';
import { type DagNodeData } from './dag-node';

describe('Data Lineage Edge Engine', () => {
  const sampleNodes: Node<DagNodeData>[] = [
    {
      id: 'node-start',
      type: 'dagNode',
      position: { x: 0, y: 0 },
      data: {
        taskReferenceName: 'start',
        taskType: 'START_WORKFLOW',
        isStartNode: true,
      },
    },
    {
      id: 'node-user',
      type: 'dagNode',
      position: { x: 200, y: 0 },
      data: {
        taskReferenceName: 'getUser',
        taskType: 'HTTP',
        inputParameters: {
          customerId: '${workflow.input.customerId}',
        },
      },
    },
    {
      id: 'node-order',
      type: 'dagNode',
      position: { x: 400, y: 0 },
      data: {
        taskReferenceName: 'createOrder',
        taskType: 'SIMPLE',
        inputParameters: {
          userEmail: '${getUser.output.body.email}',
          userId: '${getUser.output.body.id}',
        },
      },
    },
  ];

  it('extracts lineage edges from task output references and workflow inputs', () => {
    const lineageEdges = buildDataLineageEdges(sampleNodes);

    expect(lineageEdges.length).toBeGreaterThanOrEqual(2);

    // Edge 1: start -> getUser for customerId
    const startToUser = lineageEdges.find(
      (e) => e.source === 'node-start' && e.target === 'node-user'
    );
    expect(startToUser).toBeDefined();
    expect(startToUser?.data.paramKey).toBe('customerId');

    // Edge 2: getUser -> createOrder for userEmail or userId
    const userToOrder = lineageEdges.find(
      (e) => e.source === 'node-user' && e.target === 'node-order'
    );
    expect(userToOrder).toBeDefined();
    expect(userToOrder?.type).toBe('dataLineage');
    expect(userToOrder?.animated).toBe(true);
  });

  it('renders SVG path with dashed stroke and parameter pill label', () => {
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <DataLineageEdgeComponent
            id="test-edge-1"
            source="node-1"
            target="node-2"
            sourceX={0}
            sourceY={0}
            targetX={100}
            targetY={100}
            sourcePosition={'right' as any}
            targetPosition={'left' as any}
            data={{
              sourceTaskRef: 'taskA',
              targetTaskRef: 'taskB',
              paramKey: 'userId',
              expression: '${taskA.output.id}',
            }}
          />
        </svg>
      </ReactFlowProvider>
    );

    const path = container.querySelector('[data-testid="data-lineage-edge-test-edge-1"]');
    expect(path).toBeDefined();
    expect(path?.getAttribute('stroke-dasharray')).toBe('4 4');
  });
});
