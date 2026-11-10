import { type Node } from '@xyflow/react';
import { type DagNodeData } from '../canvas/dag-node';
import { taskContractRegistry } from '../utils/contracts';

export interface StepTestResult {
  nodeId: string;
  taskReferenceName: string;
  status: 'COMPLETED' | 'FAILED';
  evaluatedInputs: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
  durationMs: number;
  error?: string;
}

/**
 * Resolves a dotted path (e.g. "body.email") from an object.
 */
function resolvePath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let curr: any = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[part];
  }
  return curr;
}

/**
 * Evaluates string template expressions against workflow inputs and upstream outputs.
 */
function evaluateTemplate(
  val: unknown,
  workflowInput: Record<string, unknown>,
  upstreamOutputs: Record<string, Record<string, unknown>>
): unknown {
  if (typeof val !== 'string') return val;

  const exactMatch = val.match(/^\$\{([^}]+)\}$/);
  if (exactMatch) {
    const expr = exactMatch[1].trim();
    if (expr.startsWith('workflow.input.')) {
      const path = expr.replace('workflow.input.', '');
      return resolvePath(workflowInput, path);
    }
    const outputMatch = expr.match(/^([a-zA-Z0-9_-]+)\.output(\.(.+))?$/);
    if (outputMatch) {
      const taskRef = outputMatch[1];
      const propPath = outputMatch[3];
      const taskOutput = upstreamOutputs[taskRef];
      if (!taskOutput) return undefined;
      return propPath ? resolvePath(taskOutput, propPath) : taskOutput;
    }
    return undefined;
  }

  // Substring replacement
  return val.replace(/\$\{([^}]+)\}/g, (_, expr) => {
    const trimmed = expr.trim();
    if (trimmed.startsWith('workflow.input.')) {
      const path = trimmed.replace('workflow.input.', '');
      const res = resolvePath(workflowInput, path);
      return res !== undefined ? String(res) : '';
    }
    const outputMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\.output(\.(.+))?$/);
    if (outputMatch) {
      const taskRef = outputMatch[1];
      const propPath = outputMatch[3];
      const taskOutput = upstreamOutputs[taskRef];
      if (!taskOutput) return '';
      const res = propPath ? resolvePath(taskOutput, propPath) : taskOutput;
      return res !== undefined ? String(res) : '';
    }
    return '';
  });
}

/**
 * Executes a simulated sandbox execution for a single DAG task step.
 */
export function executeStepSandboxTest(
  node: Node<DagNodeData>,
  workflowInput: Record<string, unknown> = {},
  upstreamOutputs: Record<string, Record<string, unknown>> = {}
): StepTestResult {
  const startTime = Date.now();
  const taskRef = node.data.taskReferenceName || node.id;
  const rawInputs = node.data.inputParameters || {};

  try {
    // 1. Evaluate input parameters
    const evaluatedInputs: Record<string, unknown> = {};
    for (const [key, rawVal] of Object.entries(rawInputs)) {
      evaluatedInputs[key] = evaluateTemplate(rawVal, workflowInput, upstreamOutputs);
    }

    // 2. Generate simulated step output
    let outputPayload: Record<string, unknown> = {};

    if (node.data.mockOutputPayload && Object.keys(node.data.mockOutputPayload).length > 0) {
      outputPayload = { ...node.data.mockOutputPayload };
    } else {
      const contract = taskContractRegistry.getContract(node.data.taskType);
      outputPayload = { ...contract.defaultMockOutput };
    }

    // Specialize for specific node types if needed
    if (node.data.taskType === 'HTTP') {
      outputPayload = {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: outputPayload.body || { status: 'SUCCESS', received: evaluatedInputs },
      };
    } else if (node.data.taskType === 'JSON_JQ_TRANSFORM') {
      outputPayload = {
        result: evaluatedInputs.inputPayload || { transformed: true },
      };
    }

    const durationMs = Math.max(12, Date.now() - startTime);

    return {
      nodeId: node.id,
      taskReferenceName: taskRef,
      status: 'COMPLETED',
      evaluatedInputs,
      outputPayload,
      durationMs,
    };
  } catch (err: unknown) {
    return {
      nodeId: node.id,
      taskReferenceName: taskRef,
      status: 'FAILED',
      evaluatedInputs: rawInputs,
      outputPayload: {},
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
