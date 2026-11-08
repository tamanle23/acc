import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeData } from '../../canvas/dag-node';
import { taskContractRegistry } from '../contracts';
import { getTopologicalAncestors } from '../../canvas/variable-binding-popover';
import { type TaskWorkerDescriptor } from '@/features/workers/api/worker-fleet-api';

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export type DiagnosticRuleId =
  | 'UNRESOLVED_VARIABLE'
  | 'TEMPORAL_ORDER_VIOLATION'
  | 'CONDITIONAL_BRANCH_NULLABILITY'
  | 'MISSING_REQUIRED_INPUT'
  | 'MISSING_WORKFLOW_INPUT_SCHEMA'
  | 'MISSING_WORKFLOW_OUTPUT_SCHEMA'
  | 'UNSATISFIED_WORKFLOW_OUTPUT'
  | 'CYCLIC_DEPENDENCY';

export interface DagDiagnosticIssue {
  id: string;
  ruleId: DiagnosticRuleId;
  severity: DiagnosticSeverity;
  nodeId: string;
  taskReferenceName: string;
  paramKey?: string;
  expression?: string;
  message: string;
  suggestion?: string;
}

const EXPRESSION_REGEX = /\$\{([^}]+)\}/g;

/**
 * Traverses a parameter object and extracts all `${...}` expressions paired with their parameter key paths.
 */
function extractExpressions(
  data: unknown,
  baseKey = ''
): Array<{ key: string; rawExpression: string; innerExpr: string }> {
  const results: Array<{ key: string; rawExpression: string; innerExpr: string }> = [];

  if (data === null || data === undefined) return results;

  if (typeof data === 'string') {
    let match: RegExpExecArray | null;
    EXPRESSION_REGEX.lastIndex = 0;
    while ((match = EXPRESSION_REGEX.exec(data)) !== null) {
      results.push({
        key: baseKey,
        rawExpression: match[0],
        innerExpr: match[1].trim(),
      });
    }
  } else if (Array.isArray(data)) {
    data.forEach((item, idx) => {
      results.push(...extractExpressions(item, `${baseKey}[${idx}]`));
    });
  } else if (typeof data === 'object') {
    for (const [subKey, val] of Object.entries(data as Record<string, unknown>)) {
      const currentKey = baseKey ? `${baseKey}.${subKey}` : subKey;
      results.push(...extractExpressions(val, currentKey));
    }
  }

  return results;
}

/**
 * Checks if a candidate task is conditionally executed under a SWITCH node.
 */
function isTaskInConditionalBranch(
  candidateNodeId: string,
  nodes: Node<DagNodeData>[],
  edges: Edge[]
): boolean {
  // Check if candidateNode is reachable from any SWITCH node via a case-specific edge
  const switchEdges = edges.filter(
    (e) => e.sourceHandle && e.sourceHandle.startsWith('case-')
  );

  if (switchEdges.length === 0) return false;

  // For each switch case edge, check forward reachable nodes
  for (const edge of switchEdges) {
    const visited = new Set<string>();
    const queue = [edge.target];
    visited.add(edge.target);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === candidateNodeId) {
        return true;
      }
      for (const e of edges) {
        if (e.source === curr && !visited.has(e.target)) {
          visited.add(e.target);
          queue.push(e.target);
        }
      }
    }
  }

  return false;
}

/**
 * Pre-flight Static Semantic Linter for DAG Workflows.
 * Analyzes variable expressions, topological temporal causality, conditional nullability, and required input schemas.
 */
export function lintDagSemantics(
  nodes: Node<DagNodeData>[],
  edges: Edge[],
  workerCatalog?: TaskWorkerDescriptor[]
): DagDiagnosticIssue[] {
  const issues: DagDiagnosticIssue[] = [];
  const nodeMapByRef = new Map<string, Node<DagNodeData>>();
  const nodeMapById = new Map<string, Node<DagNodeData>>();

  nodes.forEach((n) => {
    nodeMapById.set(n.id, n);
    if (n.data?.taskReferenceName) {
      nodeMapByRef.set(n.data.taskReferenceName, n);
    }
  });

  const startNode = nodes.find(
    (n) => n.data.isStartNode || n.data.taskType === 'START_WORKFLOW'
  );
  const endNode = nodes.find(
    (n) => n.data.isEndNode || n.data.taskType === 'END_WORKFLOW'
  );

  // 1. Workflow Input Contract Audit
  const startSchema = startNode?.data?.declaredOutputSchema as Record<string, unknown> | undefined;
  const startSchemaProps = (startSchema?.properties as Record<string, unknown>) || {};
  const startInputKeys = new Set([
    ...Object.keys(startNode?.data?.inputParameters || {}),
    ...Object.keys(startSchemaProps),
  ]);

  if (startNode) {
    if (!startSchema || typeof startSchema !== 'object' || startSchema.type !== 'object') {
      issues.push({
        id: `missing-wf-input-schema-${startNode.id}`,
        ruleId: 'MISSING_WORKFLOW_INPUT_SCHEMA',
        severity: 'error',
        nodeId: startNode.id,
        taskReferenceName: startNode.data.taskReferenceName || 'workflow_start',
        message: 'Workflow is missing a defined inputSchema. Every workflow must declare its trigger input contract.',
        suggestion: 'Define properties in Start Node input contract or infer from sample payload.',
      });
    }
  }

  // 2. Workflow Output Contract Audit
  if (endNode) {
    const endSchema = endNode?.data?.declaredOutputSchema as Record<string, unknown> | undefined;
    if (!endSchema || typeof endSchema !== 'object' || endSchema.type !== 'object') {
      issues.push({
        id: `missing-wf-output-schema-${endNode.id}`,
        ruleId: 'MISSING_WORKFLOW_OUTPUT_SCHEMA',
        severity: 'error',
        nodeId: endNode.id,
        taskReferenceName: endNode.data.taskReferenceName || 'workflow_end',
        message: 'Workflow is missing a defined outputSchema. Every workflow must declare its terminal exit contract.',
        suggestion: 'Define properties in End Node output contract or infer from terminal mappings.',
      });
    } else if (Array.isArray(endSchema.required) && endSchema.required.length > 0) {
      const endInputs = endNode.data.inputParameters || {};
      for (const reqKey of endSchema.required) {
        if (typeof reqKey === 'string' && (endInputs[reqKey] === undefined || endInputs[reqKey] === '')) {
          issues.push({
            id: `unsatisfied-wf-output-${endNode.id}-${reqKey}`,
            ruleId: 'UNSATISFIED_WORKFLOW_OUTPUT',
            severity: 'error',
            nodeId: endNode.id,
            taskReferenceName: endNode.data.taskReferenceName || 'workflow_end',
            paramKey: reqKey,
            message: `Terminal exit outputSchema requires '${reqKey}', but it is not mapped in End Node parameters.`,
            suggestion: `Map '${reqKey}' to an upstream output expression (e.g. \${task.output.${reqKey}}).`,
          });
        }
      }
    }
  }

  // Analyze each node
  for (const node of nodes) {
    if (node.data.isStartNode || node.data.taskType === 'START_WORKFLOW') {
      continue;
    }

    const taskRef = node.data.taskReferenceName || node.id;
    const ancestors = getTopologicalAncestors(node.id, nodes, edges);
    const ancestorRefs = new Set(ancestors.map((a) => a.data.taskReferenceName));

    // 1. Required Inputs Check
    const workerDescriptor = workerCatalog?.find(
      (w) => w.taskType === node.data.taskType || w.workerType === node.data.taskType
    );
    const expectedParams = taskContractRegistry.getInputParameters(node.data, workerDescriptor);

    for (const reqParam of expectedParams) {
      if (reqParam.required) {
        const hasValInInputs =
          node.data.inputParameters &&
          node.data.inputParameters[reqParam.key] !== undefined &&
          node.data.inputParameters[reqParam.key] !== '';

        // Check in specialized params if applicable
        let hasValInSpecialized = false;
        if (node.data.taskType === 'HTTP' && node.data.httpParams) {
          hasValInSpecialized = Boolean(
            (node.data.httpParams as Record<string, unknown>)[reqParam.key]
          );
        } else if (node.data.taskType === 'JDBC' && node.data.jdbcParams) {
          hasValInSpecialized = Boolean(
            (node.data.jdbcParams as Record<string, unknown>)[reqParam.key]
          );
        } else if (node.data.taskType === 'JSON_JQ_TRANSFORM' && node.data.jsonJqParams) {
          hasValInSpecialized = Boolean(
            (node.data.jsonJqParams as Record<string, unknown>)[reqParam.key]
          );
        }

        if (!hasValInInputs && !hasValInSpecialized) {
          issues.push({
            id: `req-${node.id}-${reqParam.key}`,
            ruleId: 'MISSING_REQUIRED_INPUT',
            severity: 'error',
            nodeId: node.id,
            taskReferenceName: taskRef,
            paramKey: reqParam.key,
            message: `Node '${taskRef}' is missing required input '${reqParam.key}' (${reqParam.label}).`,
            suggestion: `Define '${reqParam.key}' in the node input parameters or specialized config.`,
          });
        }
      }
    }

    // 2. Expression Parsing & Semantic Variable Validation
    const expressions = extractExpressions(node.data.inputParameters || {});

    for (const { key, rawExpression, innerExpr } of expressions) {
      // Case A: workflow.input.<field>
      if (innerExpr.startsWith('workflow.input.')) {
        const fieldName = innerExpr.replace('workflow.input.', '').split('.')[0];
        if (startInputKeys.size > 0 && !startInputKeys.has(fieldName)) {
          issues.push({
            id: `unresolved-wf-input-${node.id}-${key}`,
            ruleId: 'UNRESOLVED_VARIABLE',
            severity: 'warning',
            nodeId: node.id,
            taskReferenceName: taskRef,
            paramKey: key,
            expression: rawExpression,
            message: `Parameter '${key}' references '${innerExpr}', but '${fieldName}' is not declared in workflow input schema.`,
            suggestion: `Add '${fieldName}' to Start Node input parameters or verify spelling.`,
          });
        }
        continue;
      }

      // Case B: workflow.variables.<var>
      if (innerExpr.startsWith('workflow.variables.')) {
        // Dynamic workflow variables resolved at runtime
        continue;
      }

      // Case C: <upstreamTask>.output.<prop>
      const outputMatch = innerExpr.match(/^([a-zA-Z0-9_-]+)\.output(\.(.+))?$/);
      if (outputMatch) {
        const referencedTaskRef = outputMatch[1];
        const propPath = outputMatch[3]; // may be undefined for raw .output

        const referencedNode = nodeMapByRef.get(referencedTaskRef);

        if (!referencedNode) {
          // Rule 1: Unknown Task Reference
          issues.push({
            id: `unresolved-task-${node.id}-${key}-${referencedTaskRef}`,
            ruleId: 'UNRESOLVED_VARIABLE',
            severity: 'error',
            nodeId: node.id,
            taskReferenceName: taskRef,
            paramKey: key,
            expression: rawExpression,
            message: `Parameter '${key}' references unknown task '${referencedTaskRef}'.`,
            suggestion: `Check the upstream task reference name in the DAG.`,
          });
        } else if (!ancestorRefs.has(referencedTaskRef)) {
          // Rule 2: Temporal Causality Violation (Forward reference or parallel sibling)
          issues.push({
            id: `temporal-violation-${node.id}-${key}-${referencedTaskRef}`,
            ruleId: 'TEMPORAL_ORDER_VIOLATION',
            severity: 'error',
            nodeId: node.id,
            taskReferenceName: taskRef,
            paramKey: key,
            expression: rawExpression,
            message: `Parameter '${key}' references '${referencedTaskRef}', but '${referencedTaskRef}' is not an upstream ancestor in this DAG execution path.`,
            suggestion: `Connect an edge from '${referencedTaskRef}' to an upstream dependency of '${taskRef}'.`,
          });
        } else {
          // Rule 3: Conditional Branch Nullability
          if (isTaskInConditionalBranch(referencedNode.id, nodes, edges)) {
            issues.push({
              id: `cond-null-${node.id}-${key}-${referencedTaskRef}`,
              ruleId: 'CONDITIONAL_BRANCH_NULLABILITY',
              severity: 'warning',
              nodeId: node.id,
              taskReferenceName: taskRef,
              paramKey: key,
              expression: rawExpression,
              message: `Expression '${rawExpression}' references task '${referencedTaskRef}' which executes conditionally inside a switch branch.`,
              suggestion: `Ensure a default fallback value is provided if '${referencedTaskRef}' is bypassed at runtime.`,
            });
          }

          // Rule 4: Declared Output Schema Property Check
          if (propPath) {
            const rootProp = propPath.split('.')[0];
            const schema = taskContractRegistry.resolveOutputSchema(referencedNode.data);
            const props = (schema?.properties as Record<string, unknown>) || {};
            // If the schema defines properties and does not declare additionalProperties: true
            if (Object.keys(props).length > 0 && !props[rootProp]) {
              issues.push({
                id: `schema-mismatch-${node.id}-${key}-${referencedTaskRef}-${rootProp}`,
                ruleId: 'UNRESOLVED_VARIABLE',
                severity: 'info',
                nodeId: node.id,
                taskReferenceName: taskRef,
                paramKey: key,
                expression: rawExpression,
                message: `Property '${rootProp}' is not explicitly defined in the output schema of '${referencedTaskRef}'.`,
                suggestion: `Verify property name or declare '${rootProp}' in the output schema of '${referencedTaskRef}'.`,
              });
            }
          }
        }
      }
    }
  }

  return issues;
}
