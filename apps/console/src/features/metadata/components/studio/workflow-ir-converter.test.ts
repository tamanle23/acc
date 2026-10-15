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

  it('losslessly serializes and deserializes all specialized task parameters', () => {
    const nodes: Node<DagNodeData>[] = [
      {
        id: 'n-http',
        type: 'dagNode',
        position: { x: 10, y: 20 },
        data: {
          taskReferenceName: 'httpCall',
          taskType: 'HTTP',
          httpParams: {
            method: 'POST',
            url: 'https://api.stripe.com/v1/charges',
            timeoutSeconds: 30,
          },
        },
      },
      {
        id: 'n-jdbc',
        type: 'dagNode',
        position: { x: 200, y: 20 },
        data: {
          taskReferenceName: 'sqlQuery',
          taskType: 'JDBC',
          jdbcParams: {
            datasourceId: 'billing_db',
            sql: 'SELECT * FROM invoices WHERE id = ?',
          },
        },
      },
      {
        id: 'n-jq',
        type: 'dagNode',
        position: { x: 400, y: 20 },
        data: {
          taskReferenceName: 'jqTransform',
          taskType: 'JSON_JQ_TRANSFORM',
          jsonJqParams: {
            queryExpression: '{ id: .orderId, total: .amount }',
          },
        },
      },
      {
        id: 'n-llm',
        type: 'dagNode',
        position: { x: 600, y: 20 },
        data: {
          taskReferenceName: 'llmAnalyze',
          taskType: 'LLM_CHAT_COMPLETE',
          llmParams: {
            provider: 'openai',
            model: 'gpt-4o',
            temperature: 0.2,
            prompt: 'Classify sentiment: ${workflow.input.text}',
          },
        },
      },
      {
        id: 'n-human',
        type: 'dagNode',
        position: { x: 800, y: 20 },
        data: {
          taskReferenceName: 'manualReview',
          taskType: 'HUMAN',
          humanParams: {
            role: 'RISK_OFFICER',
            slaMinutes: 180,
            instructions: 'Verify high value wire transfer.',
          },
        },
      },
      {
        id: 'n-term',
        type: 'dagNode',
        position: { x: 1000, y: 20 },
        data: {
          taskReferenceName: 'stopFlow',
          taskType: 'TERMINATE',
          terminateParams: {
            terminationStatus: 'COMPLETED',
            terminationReason: 'Flow executed cleanly',
          },
        },
      },
    ];

    const edges: Edge[] = [];
    const exportedIR = exportToWorkflowIR(nodes, edges, {
      workflowKey: 'specialized-ir-test',
    });

    expect(exportedIR.tasks).toHaveLength(6);
    expect(exportedIR.tasks[0].httpParams?.url).toBe('https://api.stripe.com/v1/charges');
    expect(exportedIR.tasks[1].jdbcParams?.datasourceId).toBe('billing_db');
    expect(exportedIR.tasks[2].jsonJqParams?.queryExpression).toBe('{ id: .orderId, total: .amount }');
    expect(exportedIR.tasks[3].llmParams?.model).toBe('gpt-4o');
    expect(exportedIR.tasks[4].humanParams?.role).toBe('RISK_OFFICER');
    expect(exportedIR.tasks[5].terminateParams?.terminationStatus).toBe('COMPLETED');

    // Roundtrip back into nodes
    const { nodes: importedNodes } = importFromWorkflowIR(exportedIR);
    expect(importedNodes).toHaveLength(6);
    expect(importedNodes[0].data.httpParams?.method).toBe('POST');
    expect(importedNodes[1].data.jdbcParams?.sql).toBe('SELECT * FROM invoices WHERE id = ?');
    expect(importedNodes[2].data.jsonJqParams?.queryExpression).toBe('{ id: .orderId, total: .amount }');
    expect(importedNodes[3].data.llmParams?.temperature).toBe(0.2);
    expect(importedNodes[4].data.humanParams?.slaMinutes).toBe(180);
    expect(importedNodes[5].data.terminateParams?.terminationReason).toBe('Flow executed cleanly');
  });
});

