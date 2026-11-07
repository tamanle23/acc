import { describe, it, expect } from 'vitest';
import { executeStepSandboxTest } from './dag-step-sandbox-runner';
import { type Node } from '@xyflow/react';
import { type DagNodeData } from '../canvas/dag-node';

describe('DagStepSandboxRunner', () => {
  it('resolves workflow inputs and upstream outputs in step evaluation', () => {
    const node: Node<DagNodeData> = {
      id: 'step-user',
      type: 'dagNode',
      position: { x: 0, y: 0 },
      data: {
        taskReferenceName: 'getUser',
        taskType: 'HTTP',
        inputParameters: {
          customerId: '${workflow.input.customerId}',
          authHeader: 'Bearer ${authTask.output.token}',
        },
      },
    };

    const workflowInput = { customerId: 'CUST-8819' };
    const upstreamOutputs = {
      authTask: { token: 'jwt-xyz-secret-token' },
    };

    const result = executeStepSandboxTest(node, workflowInput, upstreamOutputs);

    expect(result.status).toBe('COMPLETED');
    expect(result.evaluatedInputs.customerId).toBe('CUST-8819');
    expect(result.evaluatedInputs.authHeader).toBe('Bearer jwt-xyz-secret-token');
    expect(result.outputPayload.statusCode).toBe(200);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('uses custom mockOutputPayload when defined on the node', () => {
    const node: Node<DagNodeData> = {
      id: 'step-charge',
      type: 'dagNode',
      position: { x: 0, y: 0 },
      data: {
        taskReferenceName: 'chargeCard',
        taskType: 'SIMPLE',
        inputParameters: { amount: 150 },
        mockOutputPayload: {
          chargeId: 'ch_test_123',
          receiptUrl: 'https://pay.test/rec/123',
        },
      },
    };

    const result = executeStepSandboxTest(node);

    expect(result.status).toBe('COMPLETED');
    expect(result.outputPayload.chargeId).toBe('ch_test_123');
    expect(result.outputPayload.receiptUrl).toBe('https://pay.test/rec/123');
  });
});
