import { type DagNodeType, type DagNodeData } from '../../canvas/dag-node';
import { type TaskWorkerDescriptor } from '@/features/workers/api/worker-fleet-api';
import { type TaskDefinitionRecord } from '@/features/workflows/api/task-definition-api';

export type TaskContractDescriptor = TaskWorkerDescriptor | TaskDefinitionRecord;

export interface ParameterSchema {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  description?: string;
  defaultValue?: unknown;
  exampleValue?: unknown;
}

export interface NodeDataContract {
  taskType: DagNodeType;
  inputParameters: ParameterSchema[];
  outputSchema: Record<string, unknown>;
  defaultMockOutput: Record<string, unknown>;
}

export interface SchemaTreeNode {
  key: string;
  path: string;
  type: string;
  example?: unknown;
  description?: string;
  children?: SchemaTreeNode[];
}

export class TaskContractRegistry {
  private contracts: Map<DagNodeType, NodeDataContract> = new Map();
  private _isPreloaded = false;

  constructor() {
    this.registerDefaults();
  }

  /**
   * Preloads authoritative contracts from backend SSOT into client in-memory cache.
   * Enables instant 60 FPS synchronous canvas lookups without duplicate hardcoded schemas.
   */
  public preload(records: TaskDefinitionRecord[]): void {
    if (!records || !Array.isArray(records)) return;

    for (const record of records) {
      if (!record || !record.name) continue;
      const inputSchema = (record.inputSchema && typeof record.inputSchema === 'object')
        ? record.inputSchema
        : { type: 'object', properties: {} };
      const outputSchema = (record.outputSchema && typeof record.outputSchema === 'object')
        ? record.outputSchema
        : { type: 'object', properties: {} };

      const params = this.convertJsonSchemaToParams(inputSchema);
      const mockOutput = this.generateMockFromSchema(outputSchema);

      const contract: NodeDataContract = {
        taskType: record.name as DagNodeType,
        inputParameters: params,
        outputSchema,
        defaultMockOutput: mockOutput,
      };

      this.contracts.set(record.name as DagNodeType, contract);
    }
    this._isPreloaded = true;
  }

  public hasPreloaded(): boolean {
    return this._isPreloaded;
  }

  public isBuiltIn(taskType: string): boolean {
    const canonicalBuiltIns: string[] = [
      'START_WORKFLOW', 'END_WORKFLOW', 'HTTP', 'LLM_CHAT_COMPLETE',
      'KAFKA_PUBLISH', 'JDBC_QUERY', 'REDIS_COMMAND', 'JSON_JQ_TRANSFORM',
      'INLINE_SCRIPT', 'SET_VARIABLE', 'TERMINATE', 'HUMAN',
      'SWITCH', 'EXCLUSIVE_JOIN', 'FORK_JOIN', 'FORK_JOIN_DYNAMIC',
      'JOIN', 'SUB_WORKFLOW', 'DO_WHILE', 'WAIT', 'EVENT',
      'NOOP', 'DYNAMIC', 'CALL_MCP_TOOL'
    ];
    return canonicalBuiltIns.includes(taskType.toUpperCase());
  }

  register(contract: NodeDataContract): void {
    this.contracts.set(contract.taskType, contract);
  }

  getContract(type: DagNodeType | string, workerDescriptor?: TaskContractDescriptor): NodeDataContract {
    const base = this.contracts.get(type as DagNodeType) || this.createFallbackContract(type as DagNodeType);
    if (type === 'SIMPLE' && workerDescriptor) {
      return {
        ...base,
        inputParameters: workerDescriptor.inputSchema
          ? this.convertJsonSchemaToParams(workerDescriptor.inputSchema)
          : base.inputParameters,
        outputSchema: workerDescriptor.outputSchema || base.outputSchema,
        defaultMockOutput: workerDescriptor.outputSchema
          ? this.generateMockFromSchema(workerDescriptor.outputSchema)
          : base.defaultMockOutput,
      };
    }
    return base;
  }

  /**
   * Resolves input schema using the 4-tier hierarchy:
   * 1. Explicit override on node (declaredInputSchema or inputSchema)
   * 2. Worker fleet catalog descriptor or task definition (workerDescriptor.inputSchema)
   * 3. Static built-in contract default (converted from inputParameters to Draft 7)
   * 4. Permissive empty object schema fallback
   */
  resolveInputSchema(
    nodeData: DagNodeData,
    workerDescriptor?: TaskContractDescriptor
  ): Record<string, unknown> {
    const explicit = nodeData.declaredInputSchema || nodeData.inputSchema;
    if (explicit && Object.keys(explicit).length > 0) {
      return explicit;
    }
    if (nodeData.taskType === 'SIMPLE' && workerDescriptor?.inputSchema) {
      return workerDescriptor.inputSchema;
    }
    const targetKey = (nodeData.taskDefName || nodeData.taskType) as DagNodeType;
    const contract = this.getContract(targetKey, workerDescriptor);
    if (contract.inputParameters && contract.inputParameters.length > 0) {
      return this.convertParamsToJsonSchema(contract.inputParameters);
    }
    return { type: 'object', properties: {} };
  }

  /**
   * Returns parameter schemas expected by this node from the resolved input contract.
   */
  getInputParameters(
    nodeData: DagNodeData,
    workerDescriptor?: TaskContractDescriptor
  ): ParameterSchema[] {
    const explicit = nodeData.declaredInputSchema || nodeData.inputSchema;
    if (explicit && Object.keys(explicit).length > 0) {
      return this.convertJsonSchemaToParams(explicit);
    }
    if (nodeData.taskType === 'SIMPLE' && workerDescriptor?.inputSchema) {
      return this.convertJsonSchemaToParams(workerDescriptor.inputSchema);
    }
    const targetKey = (nodeData.taskDefName || nodeData.taskType) as DagNodeType;
    const contract = this.getContract(targetKey, workerDescriptor);
    return contract.inputParameters || [];
  }

  /**
   * Converts ParameterSchema array into standard Draft 7 JSON Schema.
   */
  convertParamsToJsonSchema(params: ParameterSchema[]): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const p of params) {
      properties[p.key] = {
        type: p.type === 'object' ? 'object' : p.type === 'array' ? 'array' : p.type,
        title: p.label,
        description: p.description,
        ...(p.defaultValue !== undefined ? { default: p.defaultValue } : {}),
        ...(p.exampleValue !== undefined ? { example: p.exampleValue } : {}),
      };
      if (p.required) {
        required.push(p.key);
      }
    }

    return {
      type: 'object',
      ...(required.length > 0 ? { required } : {}),
      properties,
    };
  }

  /**
   * Resolves output schema using the 4-tier hierarchy:
   * 1. Explicit override on node (declaredOutputSchema or outputSchema)
   * 2. Inferred from node mockOutputPayload
   * 3. Worker fleet catalog descriptor (workerDescriptor.outputSchema)
   * 4. Static built-in contract default
   */
  resolveOutputSchema(
    nodeData: DagNodeData,
    workerDescriptor?: TaskWorkerDescriptor
  ): Record<string, unknown> {
    if (nodeData.declaredOutputSchema && Object.keys(nodeData.declaredOutputSchema).length > 0) {
      return nodeData.declaredOutputSchema;
    }
    if (nodeData.outputSchema && Object.keys(nodeData.outputSchema).length > 0) {
      return nodeData.outputSchema;
    }
    if (nodeData.mockOutputPayload && Object.keys(nodeData.mockOutputPayload).length > 0) {
      return this.inferSchemaFromPayload(nodeData.mockOutputPayload);
    }
    if (nodeData.taskType === 'SIMPLE' && workerDescriptor?.outputSchema) {
      return workerDescriptor.outputSchema;
    }
    const targetKey = (nodeData.taskDefName || nodeData.taskType) as DagNodeType;
    const contract = this.getContract(targetKey, workerDescriptor);
    return contract.outputSchema;
  }

  /**
   * Builds an expandable schema tree for the variable picker.
   */
  getOutputSchemaTree(
    nodeData: DagNodeData,
    workerDescriptor?: TaskWorkerDescriptor
  ): SchemaTreeNode[] {
    const schema = this.resolveOutputSchema(nodeData, workerDescriptor);
    const targetKey = (nodeData.taskDefName || nodeData.taskType) as DagNodeType;
    const mock = nodeData.mockOutputPayload || this.getContract(targetKey, workerDescriptor).defaultMockOutput;
    return this.parseSchemaToTree(schema, '', mock);
  }

  private parseSchemaToTree(
    schema: Record<string, unknown>,
    basePath: string,
    mockPayload?: Record<string, unknown>
  ): SchemaTreeNode[] {
    const properties = (schema.properties as Record<string, any>) || {};
    const nodes: SchemaTreeNode[] = [];

    for (const [key, propDef] of Object.entries(properties)) {
      const currentPath = basePath ? `${basePath}.${key}` : key;
      const typeStr = (propDef.type as string) || (typeof propDef === 'object' ? 'object' : 'any');
      const exampleVal = mockPayload?.[key] !== undefined ? mockPayload[key] : propDef.example;

      const treeNode: SchemaTreeNode = {
        key,
        path: currentPath,
        type: typeStr,
        example: exampleVal,
        description: propDef.description,
      };

      if (typeStr === 'object' && propDef.properties) {
        treeNode.children = this.parseSchemaToTree(
          propDef,
          currentPath,
          typeof exampleVal === 'object' && exampleVal !== null ? (exampleVal as Record<string, unknown>) : undefined
        );
      }

      nodes.push(treeNode);
    }

    // If schema properties were empty, infer directly from mock payload
    if (nodes.length === 0 && mockPayload && typeof mockPayload === 'object') {
      for (const [key, val] of Object.entries(mockPayload)) {
        const currentPath = basePath ? `${basePath}.${key}` : key;
        const typeStr = Array.isArray(val) ? 'array' : typeof val;
        const treeNode: SchemaTreeNode = {
          key,
          path: currentPath,
          type: typeStr,
          example: val,
        };
        if (typeStr === 'object' && val !== null && !Array.isArray(val)) {
          treeNode.children = this.parseSchemaToTree(
            {},
            currentPath,
            val as Record<string, unknown>
          );
        }
        nodes.push(treeNode);
      }
    }

    return nodes;
  }

  private inferSchemaFromPayload(payload: Record<string, unknown>): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (v === null || v === undefined) {
        properties[k] = { type: 'string' };
      } else if (Array.isArray(v)) {
        properties[k] = { type: 'array' };
      } else if (typeof v === 'object') {
        properties[k] = {
          type: 'object',
          properties: this.inferSchemaFromPayload(v as Record<string, unknown>).properties,
        };
      } else {
        properties[k] = { type: typeof v };
      }
    }
    return {
      type: 'object',
      properties,
    };
  }

  public convertJsonSchemaToParams(jsonSchema: Record<string, unknown>): ParameterSchema[] {
    const props = (jsonSchema.properties as Record<string, any>) || {};
    const required = Array.isArray(jsonSchema.required) ? (jsonSchema.required as string[]) : [];

    return Object.entries(props).map(([k, def]) => ({
      key: k,
      label: def.title || k,
      type: (def.type as any) || 'string',
      required: required.includes(k),
      description: def.description,
      defaultValue: def.default,
      exampleValue: def.example,
    }));
  }

  private generateMockFromSchema(schema: Record<string, unknown>): Record<string, unknown> {
    const mock: Record<string, unknown> = {};
    const props = (schema.properties as Record<string, any>) || {};
    for (const [k, def] of Object.entries(props)) {
      if (def.example !== undefined) mock[k] = def.example;
      else if (def.default !== undefined) mock[k] = def.default;
      else if (def.type === 'string') mock[k] = `sample_${k}`;
      else if (def.type === 'number') mock[k] = 100;
      else if (def.type === 'boolean') mock[k] = true;
      else if (def.type === 'object') mock[k] = {};
      else if (def.type === 'array') mock[k] = [];
      else mock[k] = `val_${k}`;
    }
    return mock;
  }

  private createFallbackContract(type: DagNodeType): NodeDataContract {
    return {
      taskType: type,
      inputParameters: [],
      outputSchema: {
        type: 'object',
        properties: {
          result: { type: 'object', description: 'Execution output payload' },
        },
      },
      defaultMockOutput: { result: { success: true } },
    };
  }

  private registerDefaults(): void {
    // 1. Boundaries
    this.register({
      taskType: 'START_WORKFLOW',
      inputParameters: [],
      outputSchema: {
        type: 'object',
        properties: {},
      },
      defaultMockOutput: {},
    });

    this.register({
      taskType: 'END_WORKFLOW',
      inputParameters: [
        { key: 'status', label: 'Workflow Status', type: 'string', required: true, exampleValue: 'SUCCESS' },
        { key: 'payload', label: 'Result Payload', type: 'object', required: false, exampleValue: '${previousStep.output}' },
      ],
      outputSchema: { type: 'object', properties: {} },
      defaultMockOutput: {},
    });

    // 2. HTTP Connector
    this.register({
      taskType: 'HTTP',
      inputParameters: [
        { key: 'url', label: 'Endpoint URL', type: 'string', required: true, exampleValue: 'https://api.example.com/v1/resource' },
        { key: 'method', label: 'HTTP Method', type: 'string', required: true, defaultValue: 'GET' },
        { key: 'headers', label: 'Request Headers', type: 'object', required: false },
        { key: 'body', label: 'Request Body', type: 'object', required: false },
        { key: 'timeoutMs', label: 'Connection Timeout (ms)', type: 'number', required: false, defaultValue: 5000 },
      ],
      outputSchema: {
        type: 'object',
        properties: {
          status: { type: 'number', description: 'HTTP Response Status Code', example: 200 },
          body: { type: 'object', description: 'Parsed JSON response body', example: { success: true, id: '123' } },
          headers: { type: 'object', description: 'Response headers' },
          durationMs: { type: 'number', description: 'Roundtrip latency in ms', example: 84 },
        },
      },
      defaultMockOutput: {
        status: 200,
        body: { success: true, id: 'res_9921', timestamp: Date.now() },
        headers: { 'content-type': 'application/json' },
        durationMs: 76,
      },
    });

    // 3. LLM Chat Completion
    this.register({
      taskType: 'LLM_CHAT_COMPLETE',
      inputParameters: [
        { key: 'prompt', label: 'User Prompt', type: 'string', required: true, exampleValue: 'Summarize verification report' },
        { key: 'systemPrompt', label: 'System Instructions', type: 'string', required: false },
        { key: 'model', label: 'Model Name', type: 'string', required: true, defaultValue: 'gemini-1.5-pro' },
        { key: 'temperature', label: 'Temperature', type: 'number', required: false, defaultValue: 0.7 },
      ],
      outputSchema: {
        type: 'object',
        properties: {
          completion: { type: 'string', description: 'Model text response', example: 'Summary verified without defects.' },
          tokensUsed: { type: 'number', description: 'Total tokens consumed', example: 420 },
          promptTokens: { type: 'number', example: 350 },
          completionTokens: { type: 'number', example: 70 },
          model: { type: 'string', example: 'gemini-1.5-pro' },
        },
      },
      defaultMockOutput: {
        completion: 'KYC documents validated. Risk score: Low.',
        tokensUsed: 312,
        promptTokens: 250,
        completionTokens: 62,
        model: 'gemini-1.5-pro',
      },
    });

    // 4. JSON JQ Transform
    this.register({
      taskType: 'JSON_JQ_TRANSFORM',
      inputParameters: [
        { key: 'queryExpression', label: 'JQ Filter Expression', type: 'string', required: true, exampleValue: '{ userId: .id, email: .email }' },
        { key: 'inputPayload', label: 'Input JSON Object', type: 'object', required: true, exampleValue: '${httpFetch.output.body}' },
      ],
      outputSchema: {
        type: 'object',
        properties: {
          result: { type: 'object', description: 'Filtered JQ output payload', example: { userId: '101' } },
        },
      },
      defaultMockOutput: {
        result: { userId: 'usr_4401', active: true, balance: 1250 },
      },
    });

    // 5. SIMPLE Task Worker
    this.register({
      taskType: 'SIMPLE',
      inputParameters: [
        { key: 'inputData', label: 'Worker Input Parameters', type: 'object', required: false },
      ],
      outputSchema: {
        type: 'object',
        properties: {
          result: { type: 'object', description: 'Worker task execution output' },
          status: { type: 'string', example: 'COMPLETED' },
        },
      },
      defaultMockOutput: {
        result: { status: 'PROCESSED', transactionId: 'tx_8812' },
        status: 'COMPLETED',
      },
    });

    // 6. HUMAN Approval Gate
    this.register({
      taskType: 'HUMAN',
      inputParameters: [
        { key: 'role', label: 'Assignee Role', type: 'string', required: true, defaultValue: 'WORKFLOW_APPROVER' },
        { key: 'slaMinutes', label: 'SLA Duration (min)', type: 'number', required: false, defaultValue: 120 },
        { key: 'instructions', label: 'Review Guidelines', type: 'string', required: false },
        { key: 'escalationRole', label: 'Escalation Role', type: 'string', required: false },
      ],
      outputSchema: {
        type: 'object',
        properties: {
          approved: { type: 'boolean', description: 'Review decision outcome', example: true },
          resolvedBy: { type: 'string', description: 'Approver username/email', example: 'auditor@acc.io' },
          rationale: { type: 'string', description: 'Sign-off rationale or remarks', example: 'Documentation verified' },
          resolvedAtEpochMs: { type: 'number', description: 'Timestamp when approved', example: 1715000000000 },
        },
      },
      defaultMockOutput: {
        approved: true,
        resolvedBy: 'security-director@acc.io',
        rationale: 'Vendor compliance approved.',
        resolvedAtEpochMs: 1715000000000,
      },
    });

    // 7. SWITCH & EXCLUSIVE_JOIN
    this.register({
      taskType: 'SWITCH',
      inputParameters: [
        { key: 'evaluatorType', label: 'Evaluator Engine', type: 'string', required: true, defaultValue: 'value-param' },
        { key: 'expression', label: 'Evaluation Target', type: 'string', required: true, exampleValue: '${workflow.input.tier}' },
      ],
      outputSchema: {
        type: 'object',
        properties: {
          selectedCase: { type: 'string', description: 'Evaluated active branch case', example: 'GOLD' },
        },
      },
      defaultMockOutput: {
        selectedCase: 'case_1',
      },
    });

    this.register({
      taskType: 'EXCLUSIVE_JOIN',
      inputParameters: [],
      outputSchema: {
        type: 'object',
        properties: {
          executedCase: { type: 'string', example: 'case_1' },
        },
      },
      defaultMockOutput: { executedCase: 'case_1' },
    });

    // 8. FORK_JOIN & JOIN
    this.register({
      taskType: 'FORK_JOIN',
      inputParameters: [],
      outputSchema: {
        type: 'object',
        properties: {
          forkCount: { type: 'number', example: 2 },
        },
      },
      defaultMockOutput: { forkCount: 2 },
    });

    this.register({
      taskType: 'JOIN',
      inputParameters: [],
      outputSchema: {
        type: 'object',
        properties: {
          joinedTasks: { type: 'array', description: 'List of completed parallel task references' },
        },
      },
      defaultMockOutput: {
        joinedTasks: ['fork_task_1', 'fork_task_2'],
      },
    });

    // 9. DO_WHILE Loop
    this.register({
      taskType: 'DO_WHILE',
      inputParameters: [
        { key: 'loopCondition', label: 'Loop Expression', type: 'string', required: true, exampleValue: '$.step1.status == "PENDING"' },
      ],
      outputSchema: {
        type: 'object',
        properties: {
          iteration: { type: 'number', description: 'Total loop iterations executed', example: 3 },
          finalOutput: { type: 'object', description: 'Last loop body output' },
        },
      },
      defaultMockOutput: {
        iteration: 3,
        finalOutput: { status: 'RESOLVED' },
      },
    });

    // 10. SUB_WORKFLOW
    this.register({
      taskType: 'SUB_WORKFLOW',
      inputParameters: [
        { key: 'workflowKey', label: 'Sub-Workflow Key', type: 'string', required: true, exampleValue: 'payment-processing-v2' },
        { key: 'version', label: 'Workflow Version', type: 'number', required: false, defaultValue: 1 },
      ],
      outputSchema: {
        type: 'object',
        properties: {
          subWorkflowExecutionId: { type: 'string', example: 'sub-exec-9901' },
          result: { type: 'object', description: 'Sub-workflow final aggregated output' },
        },
      },
      defaultMockOutput: {
        subWorkflowExecutionId: 'sub-exec-9901',
        result: { status: 'COMPLETED', paymentRef: 'PAY-8821' },
      },
    });

    // 11. INLINE Evaluator (JavaScript / Groovy)
    this.register({
      taskType: 'INLINE',
      inputParameters: [
        { key: 'evaluatorType', label: 'Language Evaluator', type: 'string', required: true, defaultValue: 'javascript' },
        { key: 'expression', label: 'Code Expression', type: 'string', required: true, exampleValue: 'function eval() { return { result: 42 }; } eval();' },
      ],
      outputSchema: {
        type: 'object',
        properties: {
          result: { type: 'object', description: 'Return value of inline function' },
        },
      },
      defaultMockOutput: { result: { processed: true, count: 42 } },
    });

    // 12. SET_VARIABLE
    this.register({
      taskType: 'SET_VARIABLE',
      inputParameters: [
        { key: 'variables', label: 'Variables to Persist', type: 'object', required: true },
      ],
      outputSchema: {
        type: 'object',
        properties: {
          variables: { type: 'object', description: 'Persisted workflow scoped variables' },
        },
      },
      defaultMockOutput: { variables: { counter: 1, flag: true } },
    });

    // 13. JDBC Connector
    this.register({
      taskType: 'JDBC',
      inputParameters: [
        { key: 'datasourceRef', label: 'Data Source Key', type: 'string', required: true, defaultValue: 'default-pg' },
        { key: 'sqlQuery', label: 'SQL Query', type: 'string', required: true, exampleValue: 'SELECT * FROM users WHERE id = ?' },
        { key: 'parameters', label: 'Prepared Statement Parameters', type: 'array', required: false },
      ],
      outputSchema: {
        type: 'object',
        properties: {
          rows: { type: 'array', description: 'SQL result set rows' },
          rowCount: { type: 'number', example: 1 },
        },
      },
      defaultMockOutput: {
        rows: [{ id: 101, username: 'operator', status: 'ACTIVE' }],
        rowCount: 1,
      },
    });

    // 14. KAFKA_PUBLISH
    this.register({
      taskType: 'KAFKA_PUBLISH',
      inputParameters: [
        { key: 'topic', label: 'Topic Name', type: 'string', required: true, exampleValue: 'events.workflow.audit' },
        { key: 'key', label: 'Partition Key', type: 'string', required: false },
        { key: 'message', label: 'Message Payload', type: 'object', required: true },
      ],
      outputSchema: {
        type: 'object',
        properties: {
          offset: { type: 'number', example: 102450 },
          partition: { type: 'number', example: 2 },
          timestamp: { type: 'number', example: 1715000000000 },
        },
      },
      defaultMockOutput: {
        offset: 102450,
        partition: 2,
        timestamp: 1715000000000,
      },
    });

    // 15. WAIT Task
    this.register({
      taskType: 'WAIT',
      inputParameters: [
        { key: 'duration', label: 'Wait Duration (e.g. 10s, 5m)', type: 'string', required: false, defaultValue: '10s' },
        { key: 'until', label: 'Wait Until Epoch Ms', type: 'number', required: false },
      ],
      outputSchema: {
        type: 'object',
        properties: {
          waitedSeconds: { type: 'number', example: 10 },
        },
      },
      defaultMockOutput: { waitedSeconds: 10 },
    });

    // 16. TERMINATE
    this.register({
      taskType: 'TERMINATE',
      inputParameters: [
        { key: 'terminationStatus', label: 'Final Execution State', type: 'string', required: true, defaultValue: 'COMPLETED' },
        { key: 'terminationReason', label: 'Reason / Message', type: 'string', required: false },
      ],
      outputSchema: { type: 'object', properties: {} },
      defaultMockOutput: {},
    });

    // 17. NOOP
    this.register({
      taskType: 'NOOP',
      inputParameters: [],
      outputSchema: { type: 'object', properties: { passThrough: { type: 'boolean', example: true } } },
      defaultMockOutput: { passThrough: true },
    });

    // 18. EVENT
    this.register({
      taskType: 'EVENT',
      inputParameters: [
        { key: 'sink', label: 'Event Sink URI', type: 'string', required: true, exampleValue: 'conductor:order_completed' },
      ],
      outputSchema: {
        type: 'object',
        properties: {
          eventId: { type: 'string', example: 'evt_9981' },
          producedAtEpochMs: { type: 'number', example: 1715000000000 },
        },
      },
      defaultMockOutput: { eventId: 'evt_9981', producedAtEpochMs: 1715000000000 },
    });

    // 19. CALL_MCP_TOOL
    this.register({
      taskType: 'CALL_MCP_TOOL',
      inputParameters: [
        { key: 'serverName', label: 'MCP Server', type: 'string', required: true, exampleValue: 'database-inspector' },
        { key: 'toolName', label: 'MCP Tool Name', type: 'string', required: true, exampleValue: 'query_records' },
        { key: 'arguments', label: 'Tool Arguments', type: 'object', required: false },
      ],
      outputSchema: {
        type: 'object',
        properties: {
          content: { type: 'array', description: 'MCP tool response content blocks' },
          isError: { type: 'boolean', example: false },
        },
      },
      defaultMockOutput: {
        content: [{ type: 'text', text: 'Queried 5 rows successfully.' }],
        isError: false,
      },
    });

    // 20. DYNAMIC_FORK
    this.register({
      taskType: 'DYNAMIC_FORK',
      inputParameters: [
        { key: 'dynamicForkTasksParam', label: 'Fork Tasks Array Expression', type: 'string', required: true, exampleValue: '${fetchBatch.output.tasks}' },
        { key: 'dynamicForkTasksInputParamName', label: 'Fork Task Input Map Expression', type: 'string', required: true, exampleValue: '${fetchBatch.output.taskInputs}' },
      ],
      outputSchema: {
        type: 'object',
        properties: {
          forkedTaskCount: { type: 'number', example: 4 },
        },
      },
      defaultMockOutput: { forkedTaskCount: 4 },
    });

    // 21. DYNAMIC
    this.register({
      taskType: 'DYNAMIC',
      inputParameters: [
        { key: 'dynamicTaskNameParam', label: 'Target Task Name Expression', type: 'string', required: true, exampleValue: '${workflow.input.dynamicTaskName}' },
      ],
      outputSchema: {
        type: 'object',
        properties: {
          result: { type: 'object', description: 'Dynamic task execution result' },
        },
      },
      defaultMockOutput: { result: { success: true } },
    });
  }
}

export const taskContractRegistry = new TaskContractRegistry();
