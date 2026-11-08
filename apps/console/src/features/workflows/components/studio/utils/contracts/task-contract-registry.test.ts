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

  describe('4-Tier Input Schema Resolution Hierarchy', () => {
    it('resolves built-in HTTP input schema with required url and method', () => {
      const nodeData: DagNodeData = {
        taskReferenceName: 'httpCall',
        taskType: 'HTTP',
      };

      const resolved = taskContractRegistry.resolveInputSchema(nodeData);
      expect(resolved.type).toBe('object');
      expect((resolved as any).required).toContain('url');
      expect((resolved as any).required).toContain('method');
      expect((resolved.properties as any).url.type).toBe('string');
      expect((resolved.properties as any).method.type).toBe('string');

      const params = taskContractRegistry.getInputParameters(nodeData);
      expect(params.some((p) => p.key === 'url' && p.required)).toBe(true);
      expect(params.some((p) => p.key === 'method' && p.required)).toBe(true);
    });

    it('resolves custom declaredInputSchema override over defaults', () => {
      const nodeData: DagNodeData = {
        taskReferenceName: 'customStep',
        taskType: 'HTTP',
        declaredInputSchema: {
          type: 'object',
          required: ['apiKey'],
          properties: {
            apiKey: { type: 'string', title: 'API Key' },
          },
        },
      };

      const resolved = taskContractRegistry.resolveInputSchema(nodeData);
      expect((resolved as any).required).toContain('apiKey');
      expect((resolved.properties as any).url).toBeUndefined();

      const params = taskContractRegistry.getInputParameters(nodeData);
      expect(params).toHaveLength(1);
      expect(params[0].key).toBe('apiKey');
    });

    it('resolves worker fleet catalog inputSchema for SIMPLE node', () => {
      const nodeData: DagNodeData = {
        taskReferenceName: 'inventoryCheck',
        taskType: 'SIMPLE',
      };
      const workerDescriptor: TaskWorkerDescriptor = {
        taskName: 'inventoryWorker',
        domain: 'default',
        description: 'Checks inventory',
        inputSchema: {
          type: 'object',
          required: ['orderId', 'sku'],
          properties: {
            orderId: { type: 'string' },
            sku: { type: 'string' },
          },
        },
      };

      const resolved = taskContractRegistry.resolveInputSchema(nodeData, workerDescriptor);
      expect((resolved as any).required).toContain('orderId');
      expect((resolved as any).required).toContain('sku');

      const params = taskContractRegistry.getInputParameters(nodeData, workerDescriptor);
      expect(params.some((p) => p.key === 'orderId' && p.required)).toBe(true);
      expect(params.some((p) => p.key === 'sku' && p.required)).toBe(true);
    });
  });

  describe('Preloading and Single Source of Truth (SSOT)', () => {
    it('preloads authoritative task definition records into memory', () => {
      const registry = new TaskContractRegistry();
      expect(registry.hasPreloaded()).toBe(false);

      registry.preload([
        {
          taskDefId: 'td-system-http',
          tenantId: 'SYSTEM',
          name: 'HTTP',
          version: 1,
          status: 'ACTIVE',
          description: 'Platform HTTP dispatcher',
          isBuiltIn: true,
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'Destination endpoint' },
              method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
            },
            required: ['url'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              statusCode: { type: 'number' },
              responseBody: { type: 'object' },
            },
          },
        },
        {
          taskDefId: 'td-custom-fraud',
          tenantId: 'tenant-123',
          name: 'evaluateFraudRisk',
          version: 2,
          status: 'ACTIVE',
          description: 'Evaluates transaction fraud scoring',
          inputSchema: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              amount: { type: 'number' },
            },
            required: ['userId', 'amount'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              riskScore: { type: 'number' },
              action: { type: 'string' },
            },
          },
        },
      ]);

      expect(registry.hasPreloaded()).toBe(true);

      // Verify built-in lookup
      const httpContract = registry.getContract('HTTP');
      expect(httpContract.taskType).toBe('HTTP');
      expect(httpContract.inputParameters.some((p) => p.key === 'url' && p.required)).toBe(true);

      // Verify custom task lookup
      const customContract = registry.getContract('evaluateFraudRisk' as any);
      expect(customContract.taskType).toBe('evaluateFraudRisk');
      expect(customContract.inputParameters.some((p) => p.key === 'userId')).toBe(true);
      expect(customContract.outputSchema.properties).toBeDefined();

      // Verify nodeData with taskType='SIMPLE' and taskDefName='evaluateFraudRisk' resolves custom parameters
      const nodeData: DagNodeData = {
        taskReferenceName: 'fraudCheck',
        taskType: 'SIMPLE',
        taskDefName: 'evaluateFraudRisk',
        taskDefVersion: 1,
      };
      const params = registry.getInputParameters(nodeData);
      expect(params.some((p) => p.key === 'userId' && p.required)).toBe(true);
      expect(params.some((p) => p.key === 'amount' && p.required)).toBe(true);

      const resolvedInput = registry.resolveInputSchema(nodeData);
      expect((resolvedInput.properties as any).userId).toBeDefined();

      const resolvedOutput = registry.resolveOutputSchema(nodeData);
      expect((resolvedOutput.properties as any).riskScore).toBeDefined();
    });

    it('identifies built-in tasks accurately', () => {
      const registry = new TaskContractRegistry();
      expect(registry.isBuiltIn('HTTP')).toBe(true);
      expect(registry.isBuiltIn('http')).toBe(true);
      expect(registry.isBuiltIn('LLM_CHAT_COMPLETE')).toBe(true);
      expect(registry.isBuiltIn('CALL_MCP_TOOL')).toBe(true);
      expect(registry.isBuiltIn('DYNAMIC')).toBe(true);
      expect(registry.isBuiltIn('KAFKA_PUBLISH')).toBe(true);
      expect(registry.isBuiltIn('START_WORKFLOW')).toBe(true);
      expect(registry.isBuiltIn('END_WORKFLOW')).toBe(true);

      // Custom tasks are not built-in
      expect(registry.isBuiltIn('customPaymentWorker')).toBe(false);
      expect(registry.isBuiltIn('evaluateFraudRisk')).toBe(false);
    });
  });
});
