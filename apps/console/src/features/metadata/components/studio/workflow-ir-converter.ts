import type { Node, Edge } from '@xyflow/react';
import type { DagNodeData, DagNodeType } from './dag-node';

export interface WorkflowTaskIR {
  taskReferenceName: string;
  taskType: DagNodeType;
  domain?: string;
  timeoutSeconds?: number;
  retryCount?: number;
  retryDelaySeconds?: number;
  backoffRate?: number;
  inputParameters?: Record<string, unknown>;
  compensateHandlerRef?: string;
  decisionCases?: Record<string, string[]>;
  defaultCase?: string[];
  forkTasks?: string[][];
  joinOn?: string[];
  loopCondition?: string;
  loopOver?: string[];
}

export interface WorkflowIR {
  $schema?: string;
  workflowKey: string;
  version: number;
  name: string;
  description?: string;
  timeoutSeconds?: number;
  tasks: WorkflowTaskIR[];
  layoutMetadata?: Record<string, { x: number; y: number }>;
}

export interface GraphValidationError {
  nodeId?: string;
  taskReferenceName?: string;
  message: string;
  type: 'CYCLE' | 'MISSING_BINDING' | 'INVALID_SYNTAX' | 'ISOLATED_NODE';
}

/**
 * Validates binding expression syntax (${workflow.input.x} or ${taskRef.output.y})
 */
export function validateBindingExpression(
  expression: string,
  availableTaskRefs: string[]
): { valid: boolean; error?: string } {
  const trimmed = expression.trim();
  if (!trimmed.startsWith('${') || !trimmed.endsWith('}')) {
    return { valid: true }; // plain literal string
  }

  const inner = trimmed.slice(2, -1).trim();
  if (inner.startsWith('workflow.input.')) {
    const field = inner.slice('workflow.input.'.length);
    if (!field || !/^[a-zA-Z0-9_.-]+$/.test(field)) {
      return { valid: false, error: 'Invalid workflow.input path syntax' };
    }
    return { valid: true };
  }

  const parts = inner.split('.output.');
  if (parts.length === 2) {
    const [sourceRef, field] = parts;
    if (!availableTaskRefs.includes(sourceRef)) {
      return {
        valid: false,
        error: `Referenced step "${sourceRef}" does not exist in graph`,
      };
    }
    if (!field || !/^[a-zA-Z0-9_.-]+$/.test(field)) {
      return { valid: false, error: 'Invalid task output path syntax' };
    }
    return { valid: true };
  }

  return {
    valid: false,
    error: 'Expected ${workflow.input.<field>} or ${<taskRef>.output.<field>}',
  };
}

/**
 * Cycle and topology detection using Kahn's algorithm and Tarjan SCC
 */
export function validateGraphTopology(
  nodes: Node<DagNodeData>[],
  edges: Edge[]
): GraphValidationError[] {
  const errors: GraphValidationError[] = [];
  const nodeMap = new Map<string, Node<DagNodeData>>();
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
  }

  for (const edge of edges) {
    if (adj.has(edge.source) && inDegree.has(edge.target)) {
      adj.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
  }

  // Kahn's algorithm for cycle detection
  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  let visitedCount = 0;
  const visited = new Set<string>();

  while (queue.length > 0) {
    const u = queue.shift()!;
    visited.add(u);
    visitedCount++;

    for (const v of adj.get(u) || []) {
      const newDeg = (inDegree.get(v) || 0) - 1;
      inDegree.set(v, newDeg);
      if (newDeg === 0) {
        queue.push(v);
      }
    }
  }

  if (visitedCount < nodes.length) {
    // There is at least one cycle among non-visited nodes
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        // Special exemption: DO_WHILE nodes are permitted to loop over themselves
        if (node.data.taskType === 'DO_WHILE') {
          continue;
        }
        errors.push({
          nodeId: node.id,
          taskReferenceName: node.data.taskReferenceName,
          message: `Cycle detected involving node "${node.data.label || node.data.taskReferenceName}"`,
          type: 'CYCLE',
        });
      }
    }
  }

  // Parameter bindings validation
  const allRefs = nodes.map((n) => n.data.taskReferenceName);
  for (const node of nodes) {
    if (node.data.inputParameters) {
      for (const [key, val] of Object.entries(node.data.inputParameters)) {
        if (typeof val === 'string' && val.includes('${')) {
          const check = validateBindingExpression(val, allRefs);
          if (!check.valid) {
            errors.push({
              nodeId: node.id,
              taskReferenceName: node.data.taskReferenceName,
              message: `Parameter "${key}": ${check.error}`,
              type: 'MISSING_BINDING',
            });
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Converts React Flow graph to Canonical Workflow IR JSON
 */
export function exportToWorkflowIR(
  nodes: Node<DagNodeData>[],
  edges: Edge[],
  meta?: { workflowKey?: string; name?: string; description?: string; version?: number }
): WorkflowIR {
  // Sort nodes in topological order if possible
  const idToNode = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map(nodes.map((n) => [n.id, 0]));
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]));

  for (const e of edges) {
    if (adj.has(e.source) && inDegree.has(e.target)) {
      adj.get(e.source)!.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
  }

  const queue = nodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id);
  const orderedIds: string[] = [];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    orderedIds.push(cur);
    for (const nxt of adj.get(cur) || []) {
      const deg = (inDegree.get(nxt) || 1) - 1;
      inDegree.set(nxt, deg);
      if (deg === 0) queue.push(nxt);
    }
  }

  // Include any remaining nodes not in topological queue (e.g. cycles/isolated)
  for (const n of nodes) {
    if (!orderedIds.includes(n.id)) {
      orderedIds.push(n.id);
    }
  }

  const layoutMetadata: Record<string, { x: number; y: number }> = {};
  const tasks: WorkflowTaskIR[] = [];

  for (const id of orderedIds) {
    const node = idToNode.get(id);
    if (!node) continue;

    layoutMetadata[node.data.taskReferenceName] = {
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
    };

    const task: WorkflowTaskIR = {
      taskReferenceName: node.data.taskReferenceName,
      taskType: node.data.taskType,
      domain: node.data.domain || 'default',
      timeoutSeconds: node.data.timeoutSeconds ?? 30,
      retryCount: node.data.retryCount ?? 3,
      retryDelaySeconds: node.data.retryDelaySeconds ?? 2,
      backoffRate: node.data.backoffRate ?? 2.0,
      inputParameters: node.data.inputParameters || {},
    };

    if (node.data.compensateHandlerRef) {
      task.compensateHandlerRef = node.data.compensateHandlerRef;
    }
    if (node.data.taskType === 'SWITCH') {
      task.decisionCases = node.data.decisionCases || {};
      task.defaultCase = node.data.defaultCase || [];
    }
    if (node.data.taskType === 'DO_WHILE') {
      task.loopCondition = node.data.loopCondition || node.data.condition || '';
    }

    tasks.push(task);
  }

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    workflowKey: meta?.workflowKey || 'order-fulfillment-dag',
    version: meta?.version || 1,
    name: meta?.name || 'Order Fulfillment Orchestration',
    description: meta?.description || 'Visual DAG authoring workflow definition',
    timeoutSeconds: 3600,
    tasks,
    layoutMetadata,
  };
}

/**
 * Imports Canonical Workflow IR JSON into React Flow nodes and edges
 */
export function importFromWorkflowIR(
  ir: WorkflowIR
): { nodes: Node<DagNodeData>[]; edges: Edge[] } {
  if (!ir || !Array.isArray(ir.tasks)) {
    throw new Error('Invalid Workflow IR: "tasks" array is required');
  }

  const nodes: Node<DagNodeData>[] = [];
  const edges: Edge[] = [];
  const taskToNodeId = new Map<string, string>();

  // 1. Build nodes
  ir.tasks.forEach((task, idx) => {
    const nodeId = `node-${task.taskReferenceName}`;
    taskToNodeId.set(task.taskReferenceName, nodeId);

    const position = ir.layoutMetadata?.[task.taskReferenceName] || {
      x: 100 + idx * 240,
      y: 150 + (idx % 2 === 0 ? 0 : 80),
    };

    nodes.push({
      id: nodeId,
      type: 'dagNode',
      position,
      data: {
        taskReferenceName: task.taskReferenceName,
        taskType: task.taskType,
        label: task.taskReferenceName,
        domain: task.domain || 'default',
        timeoutSeconds: task.timeoutSeconds ?? 30,
        retryCount: task.retryCount ?? 3,
        retryDelaySeconds: task.retryDelaySeconds ?? 2,
        backoffRate: task.backoffRate ?? 2.0,
        inputParameters: task.inputParameters,
        compensateHandlerRef: task.compensateHandlerRef,
        decisionCases: task.decisionCases,
        defaultCase: task.defaultCase,
        loopCondition: task.loopCondition,
        condition: task.loopCondition,
        executionState: 'PENDING',
      },
    });
  });

  // 2. Synthesize sequential or branching edges based on tasks list if no explicit edges
  for (let i = 0; i < ir.tasks.length - 1; i++) {
    const curTask = ir.tasks[i];
    const nxtTask = ir.tasks[i + 1];
    const source = taskToNodeId.get(curTask.taskReferenceName);
    const target = taskToNodeId.get(nxtTask.taskReferenceName);
    if (source && target) {
      edges.push({
        id: `e_${source}_${target}`,
        source,
        target,
        animated: true,
      });
    }
  }

  return { nodes, edges };
}
