import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import {
  exportToWorkflowIR,
  importFromWorkflowIR,
  validateGraphTopology,
  validateBindingExpression,
} from './workflow-ir-converter';
import type { DagNodeData } from './dag-node';

describe('Workflow IR Converter & Graph Validation Engine', () => {
  it('validates parameter binding expressions correctly', () => {
    const validRefs = ['checkInventory', 'calculateTax'];

    // Valid workflow input
    expect(validateBindingExpression('${workflow.input.orderId}', validRefs).valid).toBe(true);

    // Valid task output
    expect(validateBindingExpression('${checkInventory.output.status}', validRefs).valid).toBe(true);

    // Literal non-expression string
    expect(validateBindingExpression('expressCourier', validRefs).valid).toBe(true);

    // Missing referenced step
    const missingRef = validateBindingExpression('${nonExistentStep.output.field}', validRefs);
    expect(missingRef.valid).toBe(false);
    expect(missingRef.error).toContain('does not exist in graph');

    // Malformed expression
    const malformed = validateBindingExpression('${somethingInvalid}', validRefs);
    expect(malformed.valid).toBe(false);
  });

  it('detects cycles using Kahn topology sort in cyclic graph', () => {
    const cyclicNodes: Node<DagNodeData>[] = [
      {
        id: 'node-A',
        type: 'dagNode',
        position: { x: 0, y: 0 },
        data: { taskReferenceName: 'stepA', taskType: 'SIMPLE' },
      },
      {
        id: 'node-B',
        type: 'dagNode',
        position: { x: 100, y: 0 },
        data: { taskReferenceName: 'stepB', taskType: 'SIMPLE' },
      },
    ];

    const cyclicEdges: Edge[] = [
      { id: 'e1', source: 'node-A', target: 'node-B' },
      { id: 'e2', source: 'node-B', target: 'node-A' }, // cycle!
    ];

    const errors = validateGraphTopology(cyclicNodes, cyclicEdges);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.type === 'CYCLE')).toBe(true);
  });

  it('passes validation on a valid acyclic DAG with correct bindings', () => {
    const nodes: Node<DagNodeData>[] = [
      {
        id: 'n1',
        type: 'dagNode',
        position: { x: 0, y: 0 },
        data: {
          taskReferenceName: 'step1',
          taskType: 'SIMPLE',
          inputParameters: { orderId: '${workflow.input.orderId}' },
        },
      },
      {
        id: 'n2',
        type: 'dagNode',
        position: { x: 200, y: 0 },
        data: {
          taskReferenceName: 'step2',
          taskType: 'SIMPLE',
          inputParameters: { parentStatus: '${step1.output.status}' },
        },
      },
    ];

    const edges: Edge[] = [{ id: 'e1', source: 'n1', target: 'n2' }];

    const errors = validateGraphTopology(nodes, edges);
    expect(errors).toHaveLength(0);
  });

  it('serializes React Flow canvas into canonical Workflow IR schema v1 with coordinates', () => {
    const nodes: Node<DagNodeData>[] = [
      {
        id: 'n1',
        type: 'dagNode',
        position: { x: 150, y: 300 },
        data: {
          taskReferenceName: 'validateOrder',
          taskType: 'SIMPLE',
          domain: 'order-service',
          timeoutSeconds: 20,
          retryCount: 4,
          retryDelaySeconds: 3,
          backoffRate: 1.5,
          compensateHandlerRef: 'cancelOrder',
        },
      },
    ];
    const edges: Edge[] = [];

    const ir = exportToWorkflowIR(nodes, edges, {
      workflowKey: 'order-flow-v1',
      name: 'Order Flow V1',
    });

    expect(ir.workflowKey).toBe('order-flow-v1');
    expect(ir.tasks).toHaveLength(1);
    expect(ir.tasks[0].taskReferenceName).toBe('validateOrder');
    expect(ir.tasks[0].domain).toBe('order-service');
    expect(ir.tasks[0].timeoutSeconds).toBe(20);
    expect(ir.tasks[0].retryCount).toBe(4);
    expect(ir.tasks[0].compensateHandlerRef).toBe('cancelOrder');

    // Verifies layout coordinate preservation
    expect(ir.layoutMetadata?.['validateOrder']).toEqual({ x: 150, y: 300 });
  });

  it('imports Canonical Workflow IR into React Flow nodes and edges without loss', () => {
    const sampleIR = {
      workflowKey: 'import-test',
      version: 1,
      name: 'Import Test',
      tasks: [
        {
          taskReferenceName: 'taskOne',
          taskType: 'SIMPLE' as const,
          timeoutSeconds: 45,
          retryCount: 2,
        },
        {
          taskReferenceName: 'taskTwo',
          taskType: 'SWITCH' as const,
          decisionCases: { TRUE: ['step3'] },
        },
      ],
      layoutMetadata: {
        taskOne: { x: 50, y: 80 },
        taskTwo: { x: 300, y: 120 },
      },
    };

    const { nodes, edges } = importFromWorkflowIR(sampleIR);

    expect(nodes).toHaveLength(2);
    expect(nodes[0].data.taskReferenceName).toBe('taskOne');
    expect(nodes[0].position).toEqual({ x: 50, y: 80 });
    expect(nodes[0].data.timeoutSeconds).toBe(45);

    expect(nodes[1].data.taskReferenceName).toBe('taskTwo');
    expect(nodes[1].position).toEqual({ x: 300, y: 120 });
    expect(nodes[1].data.taskType).toBe('SWITCH');

    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('node-taskOne');
    expect(edges[0].target).toBe('node-taskTwo');
  });
});
