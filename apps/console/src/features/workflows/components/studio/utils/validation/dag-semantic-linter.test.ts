import { describe, it, expect } from 'vitest';
import { lintDagSemantics } from './dag-semantic-linter';
import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeData } from '../../canvas/dag-node';

describe('Pre-Flight DAG Semantic Linter', () => {
  it('detects missing required inputs based on node contracts', () => {
    const nodes: Node<DagNodeData>[] = [
      {
        id: 'start-node',
        type: 'dagNode',
        position: { x: 0, y: 0 },
        data: {
          taskReferenceName: 'start',
          taskType: 'START_WORKFLOW',
          isStartNode: true,
        },
      },
      {
        id: 'http-node',
        type: 'dagNode',
        position: { x: 200, y: 0 },
        data: {
          taskReferenceName: 'fetchData',
          taskType: 'HTTP',
          // Missing required 'url' and 'method'
          inputParameters: {},
        },
      },
    ];

    const edges: Edge[] = [
      { id: 'e1', source: 'start-node', target: 'http-node' },
    ];

    const issues = lintDagSemantics(nodes, edges);
    const missingUrl = issues.find(
      (i) => i.ruleId === 'MISSING_REQUIRED_INPUT' && i.paramKey === 'url'
    );
    expect(missingUrl).toBeDefined();
    expect(missingUrl?.severity).toBe('error');
    expect(missingUrl?.message).toContain("missing required input 'url'");
  });

  it('detects unresolved task references in expressions', () => {
    const nodes: Node<DagNodeData>[] = [
      {
        id: 'start-node',
        type: 'dagNode',
        position: { x: 0, y: 0 },
        data: {
          taskReferenceName: 'start',
          taskType: 'START_WORKFLOW',
          isStartNode: true,
        },
      },
      {
        id: 'node-1',
        type: 'dagNode',
        position: { x: 200, y: 0 },
        data: {
          taskReferenceName: 'process',
          taskType: 'SIMPLE',
          inputParameters: {
            customerId: '${ghostTask.output.customerId}',
          },
        },
      },
    ];

    const edges: Edge[] = [
      { id: 'e1', source: 'start-node', target: 'node-1' },
    ];

    const issues = lintDagSemantics(nodes, edges);
    const unresolved = issues.find((i) => i.ruleId === 'UNRESOLVED_VARIABLE');
    expect(unresolved).toBeDefined();
    expect(unresolved?.severity).toBe('error');
    expect(unresolved?.message).toContain("references unknown task 'ghostTask'");
  });

  it('detects temporal order violations when referencing downstream or sibling nodes', () => {
    const nodes: Node<DagNodeData>[] = [
      {
        id: 'start-node',
        type: 'dagNode',
        position: { x: 0, y: 0 },
        data: {
          taskReferenceName: 'start',
          taskType: 'START_WORKFLOW',
          isStartNode: true,
        },
      },
      {
        id: 'step-1',
        type: 'dagNode',
        position: { x: 200, y: 0 },
        data: {
          taskReferenceName: 'stepOne',
          taskType: 'SIMPLE',
          inputParameters: {
            // Forward reference to stepTwo which is downstream!
            futureVal: '${stepTwo.output.result}',
          },
        },
      },
      {
        id: 'step-2',
        type: 'dagNode',
        position: { x: 400, y: 0 },
        data: {
          taskReferenceName: 'stepTwo',
          taskType: 'SIMPLE',
          inputParameters: {},
        },
      },
    ];

    const edges: Edge[] = [
      { id: 'e1', source: 'start-node', target: 'step-1' },
      { id: 'e2', source: 'step-1', target: 'step-2' },
    ];

    const issues = lintDagSemantics(nodes, edges);
    const temporalViolation = issues.find(
      (i) => i.ruleId === 'TEMPORAL_ORDER_VIOLATION'
    );
    expect(temporalViolation).toBeDefined();
    expect(temporalViolation?.severity).toBe('error');
    expect(temporalViolation?.message).toContain(
      "references 'stepTwo', but 'stepTwo' is not an upstream ancestor"
    );
  });

  it('warns about conditional branch nullability when referencing tasks inside a switch case', () => {
    const nodes: Node<DagNodeData>[] = [
      {
        id: 'start-node',
        type: 'dagNode',
        position: { x: 0, y: 0 },
        data: { taskReferenceName: 'start', taskType: 'START_WORKFLOW', isStartNode: true },
      },
      {
        id: 'switch-node',
        type: 'dagNode',
        position: { x: 200, y: 0 },
        data: { taskReferenceName: 'evalSwitch', taskType: 'SWITCH', condition: '${workflow.input.tier}' },
      },
      {
        id: 'express-task',
        type: 'dagNode',
        position: { x: 400, y: -100 },
        data: { taskReferenceName: 'handleExpress', taskType: 'SIMPLE', inputParameters: {} },
      },
      {
        id: 'join-node',
        type: 'dagNode',
        position: { x: 600, y: 0 },
        data: {
          taskReferenceName: 'finalJoin',
          taskType: 'EXCLUSIVE_JOIN',
          inputParameters: {
            expressRate: '${handleExpress.output.rate}',
          },
        },
      },
    ];

    const edges: Edge[] = [
      { id: 'e1', source: 'start-node', target: 'switch-node' },
      { id: 'e2', source: 'switch-node', target: 'express-task', sourceHandle: 'case-EXPRESS' },
      { id: 'e3', source: 'express-task', target: 'join-node' },
    ];

    const issues = lintDagSemantics(nodes, edges);
    const conditionalNull = issues.find(
      (i) => i.ruleId === 'CONDITIONAL_BRANCH_NULLABILITY'
    );
    expect(conditionalNull).toBeDefined();
    expect(conditionalNull?.severity).toBe('warning');
    expect(conditionalNull?.message).toContain(
      "references task 'handleExpress' which executes conditionally"
    );
  });

  it('reports no errors for a topologically valid and fully bound DAG', () => {
    const nodes: Node<DagNodeData>[] = [
      {
        id: 'start-node',
        type: 'dagNode',
        position: { x: 0, y: 0 },
        data: {
          taskReferenceName: 'start',
          taskType: 'START_WORKFLOW',
          isStartNode: true,
          inputParameters: { orderId: 'ORD-123' },
          declaredOutputSchema: {
            type: 'object',
            properties: {
              orderId: { type: 'string' },
            },
          },
        },
      },
      {
        id: 'task-a',
        type: 'dagNode',
        position: { x: 200, y: 0 },
        data: {
          taskReferenceName: 'taskA',
          taskType: 'HTTP',
          inputParameters: {
            url: 'https://api.example.com/orders/${workflow.input.orderId}',
            method: 'GET',
          },
        },
      },
      {
        id: 'task-b',
        type: 'dagNode',
        position: { x: 400, y: 0 },
        data: {
          taskReferenceName: 'taskB',
          taskType: 'SIMPLE',
          inputParameters: {
            statusCode: '${taskA.output.statusCode}',
          },
        },
      },
    ];

    const edges: Edge[] = [
      { id: 'e1', source: 'start-node', target: 'task-a' },
      { id: 'e2', source: 'task-a', target: 'task-b' },
    ];

    const issues = lintDagSemantics(nodes, edges);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('detects missing workflow input and output schemas', () => {
    const nodes: Node<DagNodeData>[] = [
      {
        id: 'start-node',
        type: 'dagNode',
        position: { x: 0, y: 0 },
        data: {
          taskReferenceName: 'start',
          taskType: 'START_WORKFLOW',
          isStartNode: true,
          // null/invalid declaredOutputSchema
          declaredOutputSchema: null as any,
          inputParameters: {},
        },
      },
      {
        id: 'end-node',
        type: 'dagNode',
        position: { x: 300, y: 0 },
        data: {
          taskReferenceName: 'end',
          taskType: 'END_WORKFLOW',
          isEndNode: true,
          declaredOutputSchema: null as any,
          inputParameters: {},
        },
      },
    ];

    const edges: Edge[] = [
      { id: 'e1', source: 'start-node', target: 'end-node' },
    ];

    const issues = lintDagSemantics(nodes, edges);
    const inputSchemaIssue = issues.find((i) => i.ruleId === 'MISSING_WORKFLOW_INPUT_SCHEMA');
    const outputSchemaIssue = issues.find((i) => i.ruleId === 'MISSING_WORKFLOW_OUTPUT_SCHEMA');

    expect(inputSchemaIssue).toBeDefined();
    expect(inputSchemaIssue?.severity).toBe('error');
    expect(outputSchemaIssue).toBeDefined();
    expect(outputSchemaIssue?.severity).toBe('error');
  });

  it('detects unsatisfied required fields in workflow exit outputSchema', () => {
    const nodes: Node<DagNodeData>[] = [
      {
        id: 'start-node',
        type: 'dagNode',
        position: { x: 0, y: 0 },
        data: {
          taskReferenceName: 'start',
          taskType: 'START_WORKFLOW',
          isStartNode: true,
          inputParameters: { orderId: 'ORD-1' },
        },
      },
      {
        id: 'end-node',
        type: 'dagNode',
        position: { x: 300, y: 0 },
        data: {
          taskReferenceName: 'end',
          taskType: 'END_WORKFLOW',
          isEndNode: true,
          declaredOutputSchema: {
            type: 'object',
            required: ['orderId', 'finalStatus'],
            properties: {
              orderId: { type: 'string' },
              finalStatus: { type: 'string' },
            },
          },
          // Missing 'finalStatus' in inputParameters
          inputParameters: {
            orderId: '${workflow.input.orderId}',
          },
        },
      },
    ];

    const edges: Edge[] = [
      { id: 'e1', source: 'start-node', target: 'end-node' },
    ];

    const issues = lintDagSemantics(nodes, edges);
    const unsatisfied = issues.find((i) => i.ruleId === 'UNSATISFIED_WORKFLOW_OUTPUT');

    expect(unsatisfied).toBeDefined();
    expect(unsatisfied?.severity).toBe('error');
    expect(unsatisfied?.paramKey).toBe('finalStatus');
    expect(unsatisfied?.message).toContain("Terminal exit outputSchema requires 'finalStatus'");
  });
});
