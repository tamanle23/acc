import type { Node, Edge } from '@xyflow/react';
import type {
  DagNodeData,
  DagNodeType,
  HttpTaskParams,
  JdbcTaskParams,
  JsonJqTaskParams,
  InlineTaskParams,
  LlmTaskParams,
  McpTaskParams,
  HumanTaskParams,
  TerminateTaskParams,
  SubWorkflowTaskParams,
  KafkaTaskParams,
} from '../canvas/dag-node';
import {
  BLANK_WORKFLOW_NODES,
  BLANK_WORKFLOW_EDGES,
} from './dag-sample-data';

export interface WorkflowTaskIR {
  taskReferenceName: string;
  taskType: DagNodeType;
  domain?: string;
  timeoutSeconds?: number;
  retryCount?: number;
  retryDelaySeconds?: number;
  backoffRate?: number;
  inputParameters?: Record<string, unknown>;
  inputSchema?: Record<string, unknown>;
  outputParameters?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  mockOutputPayload?: Record<string, unknown>;
  compensateHandlerRef?: string;
  decisionCases?: Record<string, string[]>;
  defaultCase?: string[];
  forkTasks?: string[][];
  joinOn?: string[];
  loopCondition?: string;
  loopOver?: string[];
  // Specialized Parameter Payloads
  httpParams?: HttpTaskParams;
  jdbcParams?: JdbcTaskParams;
  jsonJqParams?: JsonJqTaskParams;
  inlineParams?: InlineTaskParams;
  llmParams?: LlmTaskParams;
  mcpParams?: McpTaskParams;
  humanParams?: HumanTaskParams;
  terminateParams?: TerminateTaskParams;
  subWorkflowParams?: SubWorkflowTaskParams;
  kafkaParams?: KafkaTaskParams;
}

export const DEFAULT_DRAFT7_SCHEMA: Record<string, unknown> = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false,
};

/**
 * Infers a Draft 7 JSON Schema from a sample object payload.
 * Useful for 1-click generation from sample parameters or task mappings.
 */
export function inferDraft7Schema(sample: Record<string, unknown>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  const inferValueSchema = (val: unknown): Record<string, unknown> => {
    if (val === null || val === undefined) {
      return { type: 'string' };
    }
    if (typeof val === 'string') {
      return { type: 'string' };
    }
    if (typeof val === 'number') {
      return Number.isInteger(val) ? { type: 'integer' } : { type: 'number' };
    }
    if (typeof val === 'boolean') {
      return { type: 'boolean' };
    }
    if (Array.isArray(val)) {
      if (val.length === 0) {
        return { type: 'array', items: { type: 'string' } };
      }
      return { type: 'array', items: inferValueSchema(val[0]) };
    }
    if (typeof val === 'object') {
      const childProps: Record<string, unknown> = {};
      const childReq: string[] = [];
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        childProps[k] = inferValueSchema(v);
        childReq.push(k);
      }
      return {
        type: 'object',
        properties: childProps,
        required: childReq,
        additionalProperties: false,
      };
    }
    return { type: 'string' };
  };

  if (sample && typeof sample === 'object') {
    for (const [k, v] of Object.entries(sample)) {
      properties[k] = inferValueSchema(v);
      required.push(k);
    }
  }

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

export interface WorkflowIR {
  $schema?: string;
  workflowKey: string;
  version: number;
  name: string;
  description?: string;
  timeoutSeconds?: number;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  tasks: WorkflowTaskIR[];
  layoutMetadata?: Record<string, { x: number; y: number }>;
}

export interface GraphValidationError {
  nodeId?: string;
  taskReferenceName?: string;
  message: string;
  type:
    | 'CYCLE'
    | 'MISSING_BINDING'
    | 'INVALID_SYNTAX'
    | 'ISOLATED_NODE'
    | 'MULTIPLE_START_NODES'
    | 'MULTIPLE_END_NODES'
    | 'NO_START_NODE'
    | 'NO_END_NODE'
    | 'DISCONNECTED_GRAPH'
    | 'FORK_WITHOUT_JOIN'
    | 'DO_WHILE_NO_EXIT';
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
  if (inner.startsWith('workflow.input.') || inner.startsWith('workflow.variables.')) {
    const prefix = inner.startsWith('workflow.input.') ? 'workflow.input.' : 'workflow.variables.';
    const field = inner.slice(prefix.length);
    if (!field || !/^[a-zA-Z0-9_.-]+$/.test(field)) {
      return { valid: false, error: `Invalid ${prefix} path syntax` };
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
 * Cycle and topology detection using Kahn's algorithm and Tarjan SCC.
 * Invariant (Iteration 15): Exactly one start node (in-degree 0) and one end node (out-degree 0).
 */
export function validateGraphTopology(
  nodes: Node<DagNodeData>[],
  edges: Edge[]
): GraphValidationError[] {
  const errors: GraphValidationError[] = [];
  if (nodes.length === 0) {
    return errors;
  }

  const nodeMap = new Map<string, Node<DagNodeData>>();
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const forwardAdj = new Map<string, string[]>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    outDegree.set(node.id, 0);
    adj.set(node.id, []);
    forwardAdj.set(node.id, []);
  }

  for (const edge of edges) {
    if (adj.has(edge.source) && inDegree.has(edge.target)) {
      adj.get(edge.source)!.push(edge.target);
      const isLoopback = Boolean(
        (edge.data as any)?.isLoopbackEdge || edge.targetHandle === 'loop-back'
      );
      if (!isLoopback) {
        forwardAdj.get(edge.source)!.push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        outDegree.set(edge.source, (outDegree.get(edge.source) || 0) + 1);
      }
    }
  }

  // Kahn's algorithm for cycle detection on forward acyclic graph
  const queue: string[] = [];
  const inDegreeCopy = new Map<string, number>(inDegree);
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

    for (const v of forwardAdj.get(u) || []) {
      const newDeg = (inDegreeCopy.get(v) || 0) - 1;
      inDegreeCopy.set(v, newDeg);
      if (newDeg === 0) {
        queue.push(v);
      }
    }
  }

  let hasCycles = false;
  if (visitedCount < nodes.length) {
    // There is at least one cycle among non-visited nodes
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        // Special exemption: DO_WHILE nodes are permitted to loop over themselves
        if (node.data.taskType === 'DO_WHILE') {
          continue;
        }
        hasCycles = true;
        errors.push({
          nodeId: node.id,
          taskReferenceName: node.data.taskReferenceName,
          message: `Cycle detected involving node "${node.data.label || node.data.taskReferenceName}"`,
          type: 'CYCLE',
        });
      }
    }
  }

  // Iteration 15/16 Invariant: Conventional Single-Start & Single-End Graph Topology
  if (!hasCycles && nodes.length > 1) {
    const startNodes = nodes.filter((n) => (inDegree.get(n.id) || 0) === 0);
    if (startNodes.length === 0) {
      errors.push({
        message: 'Workflow has no start node (graph must have exactly one entry node)',
        type: 'NO_START_NODE',
      });
    } else if (startNodes.length > 1) {
      for (const sn of startNodes) {
        errors.push({
          nodeId: sn.id,
          taskReferenceName: sn.data.taskReferenceName,
          message: `Multiple start nodes detected: "${sn.data.label || sn.data.taskReferenceName}" has no prerequisite inputs. Workflows must have exactly 1 start node.`,
          type: 'MULTIPLE_START_NODES',
        });
      }
    }

    const loopbackSourceIds = new Set(
      edges
        .filter((e) => e.targetHandle === 'loop-back' || (e.data as any)?.isLoopbackEdge)
        .map((e) => e.source)
    );
    const compensateTargetIds = new Set(
      edges.filter((e) => e.sourceHandle === 'compensate').map((e) => e.target)
    );
    const endNodes = nodes.filter(
      (n) => (outDegree.get(n.id) || 0) === 0 && !loopbackSourceIds.has(n.id) && !compensateTargetIds.has(n.id)
    );
    if (endNodes.length === 0) {
      errors.push({
        message: 'Workflow has no terminal end node (graph must converge to exactly one exit node)',
        type: 'NO_END_NODE',
      });
    } else if (endNodes.length > 1) {
      for (const en of endNodes) {
        errors.push({
          nodeId: en.id,
          taskReferenceName: en.data.taskReferenceName,
          message: `Multiple end nodes detected: "${en.data.label || en.data.taskReferenceName}" has no downstream connection. Parallel or branched tasks must converge into a single terminal end node.`,
          type: 'MULTIPLE_END_NODES',
        });
      }
    }

    // Reachability verification from the single start node
    if (startNodes.length === 1) {
      const reachableFromStart = new Set<string>();
      const q = [startNodes[0].id];
      reachableFromStart.add(startNodes[0].id);

      while (q.length > 0) {
        const cur = q.shift()!;
        for (const nxt of forwardAdj.get(cur) || []) {
          if (!reachableFromStart.has(nxt)) {
            reachableFromStart.add(nxt);
            q.push(nxt);
          }
        }
      }

      for (const n of nodes) {
        if (!reachableFromStart.has(n.id)) {
          errors.push({
            nodeId: n.id,
            taskReferenceName: n.data.taskReferenceName,
            message: `Node "${n.data.label || n.data.taskReferenceName}" is unreachable from the start node "${startNodes[0].data.label || startNodes[0].data.taskReferenceName}"`,
            type: 'DISCONNECTED_GRAPH',
          });
        }
      }
    }

    // Iteration 16 Invariant: FORK_JOIN and JOIN pairing & convergence
    const forkNodes = nodes.filter((n) => n.data.taskType === 'FORK_JOIN');
    const joinNodes = nodes.filter((n) => n.data.taskType === 'JOIN' || n.data.taskType === 'EXCLUSIVE_JOIN');

    for (const fork of forkNodes) {
      if (joinNodes.length === 0) {
        errors.push({
          nodeId: fork.id,
          taskReferenceName: fork.data.taskReferenceName,
          message: `Parallel Fork node "${fork.data.label || fork.data.taskReferenceName}" branches must converge into a matching Join barrier node before workflow end.`,
          type: 'FORK_WITHOUT_JOIN',
        });
        continue;
      }

      const branchChildren = forwardAdj.get(fork.id) || [];
      const joinNodeIds = new Set(joinNodes.map((j) => j.id));

      for (const childId of branchChildren) {
        if (joinNodeIds.has(childId)) continue;
        const q = [childId];
        const seen = new Set<string>([childId]);
        let branchHitsEndWithoutJoin = false;

        while (q.length > 0) {
          const cur = q.shift()!;
          const curNode = nodeMap.get(cur);
          const curOutDeg = outDegree.get(cur) ?? 0;
          if (curOutDeg === 0 || curNode?.data.isEndNode) {
            branchHitsEndWithoutJoin = true;
            break;
          }
          for (const nxt of forwardAdj.get(cur) || []) {
            if (!joinNodeIds.has(nxt) && !seen.has(nxt)) {
              seen.add(nxt);
              q.push(nxt);
            }
          }
        }

        if (branchHitsEndWithoutJoin) {
          errors.push({
            nodeId: fork.id,
            taskReferenceName: fork.data.taskReferenceName,
            message: `Parallel Fork node "${fork.data.label || fork.data.taskReferenceName}" has branch reaching end without converging into a Join barrier.`,
            type: 'FORK_WITHOUT_JOIN',
          });
          break;
        }
      }
    }

    // Iteration 16 Invariant: DO_WHILE exit branch check
    const doWhileNodes = nodes.filter((n) => n.data.taskType === 'DO_WHILE');
    for (const loopNode of doWhileNodes) {
      const forwardChildren = forwardAdj.get(loopNode.id) || [];
      if (forwardChildren.length === 0) {
        errors.push({
          nodeId: loopNode.id,
          taskReferenceName: loopNode.data.taskReferenceName,
          message: `DO_WHILE node "${loopNode.data.label || loopNode.data.taskReferenceName}" must have an exit branch leading downstream to the workflow end.`,
          type: 'DO_WHILE_NO_EXIT',
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
      ...(node.data.isPermanent ? { isPermanent: true } : {}),
      ...(node.data.isStartNode ? { isStartNode: true } : {}),
      ...(node.data.isEndNode ? { isEndNode: true } : {}),
    } as any;

    const task: WorkflowTaskIR = {
      taskReferenceName: node.data.taskReferenceName,
      taskType: node.data.taskType,
      domain: node.data.domain || 'default',
      timeoutSeconds: node.data.timeoutSeconds ?? 30,
      retryCount: node.data.retryCount ?? 3,
      retryDelaySeconds: node.data.retryDelaySeconds ?? 2,
      backoffRate: node.data.backoffRate ?? 2.0,
      inputParameters: node.data.inputParameters || {},
      ...(node.data.inputSchema || node.data.declaredInputSchema
        ? { inputSchema: node.data.inputSchema || node.data.declaredInputSchema }
        : {}),
      ...(node.data.outputParameters ? { outputParameters: node.data.outputParameters } : {}),
      ...(node.data.declaredOutputSchema || node.data.outputSchema
        ? { outputSchema: node.data.declaredOutputSchema || node.data.outputSchema }
        : {}),
      ...(node.data.mockOutputPayload ? { mockOutputPayload: node.data.mockOutputPayload } : {}),
    };

    // 1. Resolve compensateHandlerRef from edge or node data
    const compEdge = edges.find((e) => e.source === node.id && e.sourceHandle === 'compensate');
    if (compEdge) {
      const compRef = idToNode.get(compEdge.target)?.data.taskReferenceName;
      if (compRef) {
        task.compensateHandlerRef = compRef;
      }
    } else if (node.data.compensateHandlerRef) {
      task.compensateHandlerRef = node.data.compensateHandlerRef;
    }

    // 2. Resolve SWITCH cases from edge handles or node data
    if (node.data.taskType === 'SWITCH') {
      const switchEdges = edges.filter((e) => e.source === node.id);
      const derivedCases: Record<string, string[]> = { ...(node.data.decisionCases || {}) };
      const derivedDefault: string[] = [...(node.data.defaultCase || [])];

      for (const se of switchEdges) {
        const targetRef = idToNode.get(se.target)?.data.taskReferenceName;
        if (!targetRef) continue;

        if (se.sourceHandle?.startsWith('case-')) {
          const caseKey = se.sourceHandle.slice(5);
          if (caseKey === 'default') {
            if (!derivedDefault.includes(targetRef)) derivedDefault.push(targetRef);
          } else {
            derivedCases[caseKey] = derivedCases[caseKey] || [];
            if (!derivedCases[caseKey].includes(targetRef)) derivedCases[caseKey].push(targetRef);
          }
        } else if (se.data?.decisionCase) {
          const caseKey = se.data.decisionCase;
          if (caseKey === 'DEFAULT' || se.data.isDefaultCase) {
            if (!derivedDefault.includes(targetRef)) derivedDefault.push(targetRef);
          } else {
            derivedCases[caseKey] = derivedCases[caseKey] || [];
            if (!derivedCases[caseKey].includes(targetRef)) derivedCases[caseKey].push(targetRef);
          }
        }
      }
      task.decisionCases = derivedCases;
      task.defaultCase = derivedDefault;
    }

    // 3. Resolve DO_WHILE loopOver and condition
    if (node.data.taskType === 'DO_WHILE') {
      task.loopCondition = node.data.loopCondition || node.data.condition || '';
      const bodyEdge = edges.find((e) => e.source === node.id && e.sourceHandle === 'loop-body');
      if (bodyEdge) {
        const loopBodySet = new Set<string>();
        const q = [bodyEdge.target];
        loopBodySet.add(bodyEdge.target);

        while (q.length > 0) {
          const curr = q.shift()!;
          for (const e of edges) {
            if (e.source === curr && e.target !== node.id && !loopBodySet.has(e.target)) {
              loopBodySet.add(e.target);
              q.push(e.target);
            }
          }
        }
        task.loopOver = Array.from(loopBodySet)
          .map((id) => idToNode.get(id)?.data.taskReferenceName)
          .filter((ref): ref is string => Boolean(ref));
      }
    }

    // 4. Resolve JOIN / EXCLUSIVE_JOIN incoming prerequisites
    if (node.data.taskType === 'JOIN' || node.data.taskType === 'EXCLUSIVE_JOIN') {
      const incomingRefs = edges
        .filter((e) => e.target === node.id && e.targetHandle !== 'loop-back')
        .map((e) => idToNode.get(e.source)?.data.taskReferenceName)
        .filter((ref): ref is string => Boolean(ref));
      task.joinOn = incomingRefs;
    }

    // 5. General joinOn for non-start tasks
    if (!task.joinOn && !node.data.isStartNode && node.data.taskType !== 'START_WORKFLOW') {
      const inboundRefs = edges
        .filter((e) => e.target === node.id && e.targetHandle !== 'loop-back' && !(e.data as any)?.isLoopbackEdge)
        .map((e) => idToNode.get(e.source)?.data.taskReferenceName)
        .filter((ref): ref is string => Boolean(ref));
      if (inboundRefs.length > 0) {
        task.joinOn = inboundRefs;
      }
    }

    if (node.data.taskType === 'FORK_JOIN') {
      const branchRefs = edges
        .filter((e) => e.source === node.id)
        .map((e) => idToNode.get(e.target)?.data.taskReferenceName)
        .filter((ref): ref is string => Boolean(ref));
      task.forkTasks = branchRefs.map((r) => [r]);
    }

    // Preserve specialized payloads
    if (node.data.httpParams) task.httpParams = node.data.httpParams;
    if (node.data.jdbcParams) task.jdbcParams = node.data.jdbcParams;
    if (node.data.jsonJqParams) task.jsonJqParams = node.data.jsonJqParams;
    if (node.data.inlineParams) task.inlineParams = node.data.inlineParams;
    if (node.data.llmParams) task.llmParams = node.data.llmParams;
    if (node.data.mcpParams) task.mcpParams = node.data.mcpParams;
    if (node.data.humanParams) task.humanParams = node.data.humanParams;
    if (node.data.terminateParams) task.terminateParams = node.data.terminateParams;
    if (node.data.subWorkflowParams) task.subWorkflowParams = node.data.subWorkflowParams;
    if (node.data.kafkaParams) task.kafkaParams = node.data.kafkaParams;

    tasks.push(task);
  }

  (layoutMetadata as any).__edges = edges.map((e) => ({
    id: e.id,
    source: idToNode.get(e.source)?.data.taskReferenceName || e.source,
    target: idToNode.get(e.target)?.data.taskReferenceName || e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    label: e.label,
    animated: e.animated,
    data: e.data,
  }));

  const startNode = nodes.find((n) => n.data.isStartNode || n.data.taskType === 'START_WORKFLOW');
  const endNode = nodes.find((n) => n.data.isEndNode || n.data.taskType === 'END_WORKFLOW');

  const inputSchema = (startNode?.data.declaredOutputSchema as Record<string, unknown>) || DEFAULT_DRAFT7_SCHEMA;
  const outputSchema = (endNode?.data.declaredOutputSchema as Record<string, unknown>) || DEFAULT_DRAFT7_SCHEMA;

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    workflowKey: meta?.workflowKey || 'order-fulfillment-dag',
    version: meta?.version || 1,
    name: meta?.name || 'Order Fulfillment Orchestration',
    description: meta?.description || 'Visual DAG authoring workflow definition',
    timeoutSeconds: 3600,
    inputSchema,
    outputSchema,
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

  // Blank definition fallback: START and END boundary nodes connected by initial edge
  if (ir.tasks.length === 0) {
    return {
      nodes: BLANK_WORKFLOW_NODES,
      edges: BLANK_WORKFLOW_EDGES,
    };
  }

  // If definition only contains a single start task (e.g. legacy blank definition), supplement with terminal end node
  const tasksToProcess = [...ir.tasks];
  const firstTask = tasksToProcess[0];
  const isOnlyStart =
    tasksToProcess.length === 1 &&
    (firstTask.taskReferenceName === 'workflow_start' ||
      firstTask.taskReferenceName === 'start' ||
      firstTask.taskReferenceName === 'startTask');

  if (isOnlyStart) {
    tasksToProcess.push({
      taskReferenceName: 'workflow_end',
      taskType: 'NOOP',
      domain: 'default',
    });
  }

  const nodes: Node<DagNodeData>[] = [];
  const edges: Edge[] = [];
  const taskToNodeId = new Map<string, string>();

  // 1. Build nodes
  tasksToProcess.forEach((task, idx) => {
    const nodeId = `node-${task.taskReferenceName}`;
    taskToNodeId.set(task.taskReferenceName, nodeId);

    const position = ir.layoutMetadata?.[task.taskReferenceName] || {
      x: 100 + idx * 240,
      y: 150 + (idx % 2 === 0 ? 0 : 80),
    };

    const metaLayout = (ir.layoutMetadata?.[task.taskReferenceName] as any) || {};
    const isStartNode = Boolean(
      metaLayout.isStartNode ||
        task.taskType === 'START_WORKFLOW' ||
        (idx === 0 &&
          (task.taskReferenceName === 'workflow_start' ||
            task.taskReferenceName === 'start' ||
            task.taskReferenceName === 'startTask'))
    );
    const isEndNode = Boolean(
      metaLayout.isEndNode ||
        task.taskType === 'END_WORKFLOW' ||
        (idx === tasksToProcess.length - 1 &&
          (task.taskReferenceName === 'workflow_end' ||
            task.taskReferenceName === 'end' ||
            task.taskType === 'TERMINATE'))
    );
    const isPermanent = Boolean(metaLayout.isPermanent || isStartNode || isEndNode);

    const label =
      task.taskReferenceName === 'workflow_start' ||
      task.taskReferenceName === 'startTask' ||
      task.taskType === 'START_WORKFLOW'
        ? 'Workflow Start'
        : task.taskReferenceName === 'workflow_end' ||
            task.taskType === 'END_WORKFLOW'
          ? 'Workflow End'
          : task.taskReferenceName;

    nodes.push({
      id: nodeId,
      type: 'dagNode',
      position,
      data: {
        taskReferenceName: task.taskReferenceName,
        taskType: task.taskType,
        label,
        domain: task.domain || 'default',
        timeoutSeconds: task.timeoutSeconds ?? 30,
        retryCount: task.retryCount ?? 3,
        retryDelaySeconds: task.retryDelaySeconds ?? 2,
        backoffRate: task.backoffRate ?? 2.0,
        inputParameters: task.inputParameters,
        inputSchema: task.inputSchema,
        declaredInputSchema: isEndNode
          ? task.inputSchema || ir.outputSchema || DEFAULT_DRAFT7_SCHEMA
          : task.inputSchema,
        outputParameters: task.outputParameters,
        outputSchema: task.outputSchema,
        declaredOutputSchema: isStartNode
          ? task.outputSchema || ir.inputSchema || DEFAULT_DRAFT7_SCHEMA
          : isEndNode
            ? task.outputSchema || ir.outputSchema || DEFAULT_DRAFT7_SCHEMA
            : task.outputSchema,
        mockOutputPayload: task.mockOutputPayload,
        compensateHandlerRef: task.compensateHandlerRef,
        decisionCases: task.decisionCases,
        defaultCase: task.defaultCase,
        loopCondition: task.loopCondition,
        condition: task.loopCondition,
        httpParams: task.httpParams,
        jdbcParams: task.jdbcParams,
        jsonJqParams: task.jsonJqParams,
        inlineParams: task.inlineParams,
        llmParams: task.llmParams,
        mcpParams: task.mcpParams,
        humanParams: task.humanParams,
        terminateParams: task.terminateParams,
        subWorkflowParams: task.subWorkflowParams,
        kafkaParams: task.kafkaParams,
        executionState: 'PENDING',
        isPermanent,
        isStartNode,
        isEndNode,
      },
    });
  });

  // 2. Synthesize edges from saved __edges or reconstruct from joinOn, forkTasks, loopOver, compensateHandlerRef, and decisionCases
  const synthesizedEdges: Edge[] = [];
  const edgeSet = new Set<string>();

  const addEdgeSafe = (edge: Edge) => {
    const key = `${edge.source}->${edge.target}${edge.sourceHandle ? ':' + edge.sourceHandle : ''}${edge.targetHandle ? '@' + edge.targetHandle : ''}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      synthesizedEdges.push(edge);
    }
  };

  const savedEdges = (ir.layoutMetadata as any)?.__edges;
  if (Array.isArray(savedEdges) && savedEdges.length > 0) {
    savedEdges.forEach((se: any) => {
      const sourceId = taskToNodeId.get(se.source) || se.source;
      const targetId = taskToNodeId.get(se.target) || se.target;
      if (sourceId && targetId) {
        addEdgeSafe({
          id: se.id || `e_${sourceId}_${targetId}`,
          type: 'dagEdge',
          source: sourceId,
          target: targetId,
          sourceHandle: se.sourceHandle,
          targetHandle: se.targetHandle,
          label: se.label,
          animated: se.animated ?? true,
          data: se.data || {},
        });
      }
    });
  } else {
    // Reconstruct edges from joinOn
    tasksToProcess.forEach((task) => {
      const targetId = taskToNodeId.get(task.taskReferenceName);
      if (targetId && Array.isArray(task.joinOn) && task.joinOn.length > 0) {
        task.joinOn.forEach((prereqRef) => {
          const sourceId = taskToNodeId.get(prereqRef);
          if (sourceId) {
            addEdgeSafe({
              id: `e_${sourceId}_${targetId}`,
              type: 'dagEdge',
              source: sourceId,
              target: targetId,
              animated: true,
            });
          }
        });
      }
    });

    // Reconstruct edges from SWITCH decisionCases & defaultCase
    tasksToProcess.forEach((task) => {
      const sourceId = taskToNodeId.get(task.taskReferenceName);
      if (sourceId && task.taskType === 'SWITCH') {
        if (task.decisionCases) {
          Object.entries(task.decisionCases).forEach(([caseKey, targetRefs]) => {
            (targetRefs || []).forEach((tRef) => {
              const targetId = taskToNodeId.get(tRef);
              if (targetId) {
                addEdgeSafe({
                  id: `e_${sourceId}_${targetId}_${caseKey}`,
                  type: 'dagEdge',
                  source: sourceId,
                  target: targetId,
                  sourceHandle: `case-${caseKey}`,
                  label: caseKey,
                  animated: true,
                  data: { decisionCase: caseKey },
                });
              }
            });
          });
        }
        if (task.defaultCase) {
          (task.defaultCase || []).forEach((tRef) => {
            const targetId = taskToNodeId.get(tRef);
            if (targetId) {
              addEdgeSafe({
                id: `e_${sourceId}_${targetId}_default`,
                type: 'dagEdge',
                source: sourceId,
                target: targetId,
                sourceHandle: 'case-default',
                label: 'DEFAULT',
                animated: true,
                data: { isDefaultCase: true, decisionCase: 'DEFAULT' },
              });
            }
          });
        }
      }
    });

    // Reconstruct edges from DO_WHILE loopOver
    tasksToProcess.forEach((task) => {
      if (task.taskType === 'DO_WHILE' && Array.isArray(task.loopOver) && task.loopOver.length > 0) {
        const loopId = taskToNodeId.get(task.taskReferenceName);
        const firstBodyId = taskToNodeId.get(task.loopOver[0]);
        const lastBodyId = taskToNodeId.get(task.loopOver[task.loopOver.length - 1]);
        if (loopId && firstBodyId) {
          addEdgeSafe({
            id: `e_${loopId}_${firstBodyId}_loop_body`,
            type: 'dagEdge',
            source: loopId,
            target: firstBodyId,
            sourceHandle: 'loop-body',
            targetHandle: 'target-left',
            label: 'BODY',
            animated: true,
          });
        }
        if (loopId && lastBodyId) {
          addEdgeSafe({
            id: `e_${lastBodyId}_${loopId}_loop_back`,
            type: 'dagEdge',
            source: lastBodyId,
            target: loopId,
            sourceHandle: 'source-right',
            targetHandle: 'loop-back',
            label: 'LOOP-BACK',
            animated: true,
            data: { isLoopbackEdge: true },
          });
        }
      }
    });

    // Reconstruct edges from compensateHandlerRef
    tasksToProcess.forEach((task) => {
      if (task.compensateHandlerRef) {
        const sourceId = taskToNodeId.get(task.taskReferenceName);
        const compId = taskToNodeId.get(task.compensateHandlerRef);
        if (sourceId && compId) {
          addEdgeSafe({
            id: `e_${sourceId}_${compId}_compensate`,
            type: 'dagEdge',
            source: sourceId,
            target: compId,
            sourceHandle: 'compensate',
            targetHandle: 'target-left',
            label: 'COMPENSATE',
            animated: true,
          });
        }
      }
    });

    // Fallback: If no explicit joinOn / switch edges were created, link sequentially
    if (synthesizedEdges.length === 0) {
      for (let i = 0; i < tasksToProcess.length - 1; i++) {
        const curTask = tasksToProcess[i];
        const nxtTask = tasksToProcess[i + 1];
        const source = taskToNodeId.get(curTask.taskReferenceName);
        const target = taskToNodeId.get(nxtTask.taskReferenceName);
        if (source && target) {
          addEdgeSafe({
            id: `e_${source}_${target}`,
            type: 'dagEdge',
            source,
            target,
            animated: true,
          });
        }
      }
    }
  }

  edges.push(...synthesizedEdges);

  return { nodes, edges };
}
