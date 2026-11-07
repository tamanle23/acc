import { describe, it, expect } from 'vitest';
import { taskContractRegistry, TaskContractRegistry } from './task-contract-registry';
import { type DagNodeData } from '../../canvas/dag-node';
import { type TaskWorkerDescriptor } from '@/features/workers/api/worker-fleet-api';

describe('TaskContractRegistry', () => {
  it('retrieves built-in contracts for standard node types', () => {
    const httpContract = taskContractRegistry.getContract('HTTP');
    expect(httpContract.taskType).toBe('HTTP');
    expect(httpContract.inputParameters.some((p) => p.key === 'url')).toBe(true);
    expect(httpContract.outputSchema.properties).toBeDefined();

    const llmContract = taskContractRegistry.getContract('LLM_CHAT_COMPLETE');
    expect(llmContract.taskType).toBe('LLM_CHAT_COMPLETE');
    expect(llmContract.inputParameters.some((p) => p.key === 'prompt')).toBe(true);

    const jqContract = taskContractRegistry.getContract('JSON_JQ_TRANSFORM');
    expect(jqContract.inputParameters.some((p) => p.key === 'queryExpression')).toBe(true);

    const humanContract = taskContractRegistry.getContract('HUMAN');
    expect(humanContract.inputParameters.some((p) => p.key === 'role')).toBe(true);
  });

  describe('4-Tier Output Schema Resolution Hierarchy', () => {
    it('Tier 1: Explicit declaredOutputSchema on node takes top priority', () => {
      const nodeData: DagNodeData = {
        taskReferenceName: 'httpStep',
        taskType: 'HTTP',
        declaredOutputSchema: {
          type: 'object',
          properties: {
            customToken: { type: 'string', example: 'jwt_123' },
          },
        },
        mockOutputPayload: { ignored: true },
      };

      const resolved = taskContractRegistry.resolveOutputSchema(nodeData);
      expect((resolved.properties as any).customToken).toBeDefined();
      expect((resolved.properties as any).status).toBeUndefined(); // Base HTTP schema overridden
    });

    it('Tier 2: Inferred schema from mockOutputPayload when declaredOutputSchema is absent', () => {
      const nodeData: DagNodeData = {
        taskReferenceName: 'orderProcessor',
        taskType: 'SIMPLE',
        mockOutputPayload: {
          invoiceId: 'INV-4001',
          totalAmount: 250.75,
          isPaid: true,
          nested: {
            currency: 'USD',
          },
        },
      };

      const resolved = taskContractRegistry.resolveOutputSchema(nodeData);
      const props = resolved.properties as Record<string, any>;
      expect(props.invoiceId.type).toBe('string');
      expect(props.totalAmount.type).toBe('number');
      expect(props.isPaid.type).toBe('boolean');
      expect(props.nested.type).toBe('object');
      expect(props.nested.properties.currency.type).toBe('string');
    });

    it('Tier 3: TaskWorkerDescriptor outputSchema for SIMPLE task when no node override', () => {
      const nodeData: DagNodeData = {
        taskReferenceName: 'creditCheck',
        taskType: 'SIMPLE',
      };
      const workerDescriptor: TaskWorkerDescriptor = {
        taskName: 'creditCheckWorker',
        domain: 'finance',
        description: 'Runs credit score evaluation',
        maxConcurrency: 10,
        timeoutSeconds: 30,
        outputSchema: {
          type: 'object',
          properties: {
            score: { type: 'number', example: 780 },
            approved: { type: 'boolean', example: true },
          },
        },
      };

      const resolved = taskContractRegistry.resolveOutputSchema(nodeData, workerDescriptor);
      const props = resolved.properties as Record<string, any>;
      expect(props.score.type).toBe('number');
      expect(props.approved.type).toBe('boolean');
    });

    it('Tier 4: Static contract defaults when no overrides exist', () => {
      const nodeData: DagNodeData = {
        taskReferenceName: 'httpCall',
        taskType: 'HTTP',
      };

      const resolved = taskContractRegistry.resolveOutputSchema(nodeData);
      const props = resolved.properties as Record<string, any>;
      expect(props.status.type).toBe('number');
      expect(props.body.type).toBe('object');
      expect(props.durationMs.type).toBe('number');
    });
  });

  describe('getOutputSchemaTree', () => {
    it('generates recursive SchemaTreeNode list with dot-separated paths', () => {
      const nodeData: DagNodeData = {
        taskReferenceName: 'apiFetch',
        taskType: 'HTTP',
        mockOutputPayload: {
          status: 200,
          data: {
            user: {
              id: 'USR-1',
              email: 'test@example.com',
            },
          },
        },
      };

      const tree = taskContractRegistry.getOutputSchemaTree(nodeData);
      expect(tree.length).toBeGreaterThan(0);

      const dataNode = tree.find((t) => t.key === 'data');
      expect(dataNode).toBeDefined();
      expect(dataNode!.path).toBe('data');
      expect(dataNode!.children).toBeDefined();

      const userNode = dataNode!.children?.find((t) => t.key === 'user');
      expect(userNode).toBeDefined();
      expect(userNode!.path).toBe('data.user');
      expect(userNode!.children?.find((t) => t.key === 'email')?.path).toBe('data.user.email');
    });
  });
});
