// ==========================================
// Workflow Definition & Authoring Contracts
// ==========================================

export interface WorkflowTaskDefinition {
  name: string;
  taskReferenceName: string;
  description?: string;
  taskType:
    | 'SIMPLE'
    | 'SWITCH'
    | 'FORK_JOIN'
    | 'DYNAMIC_FORK'
    | 'WAIT'
    | 'DO_WHILE'
    | 'MANUAL'
    | 'HTTP'
    | 'JDBC'
    | 'JSON_JQ_TRANSFORM'
    | 'INLINE'
    | 'LLM_CHAT_COMPLETE'
    | 'CALL_MCP_TOOL'
    | 'HUMAN'
    | 'TERMINATE'
    | 'SUB_WORKFLOW'
    | (string & {});
  inputParameters?: Record<string, unknown>;
  retryCount?: number;
  retryLogic?: string;
  retryDelaySeconds?: number;
  timeoutSeconds?: number;
  responseTimeoutSeconds?: number;
  optional?: boolean;
  asyncComplete?: boolean;
  [key: string]: unknown;
}

export interface WorkflowDefinition {
  workflowKey: string;
  name: string;
  version: number;
  description?: string;
  tasks: WorkflowTaskDefinition[];
  inputParameters?: string[];
  outputParameters?: Record<string, unknown>;
  schemaVersion?: number;
  restartable?: boolean;
  workflowStatusListenerEnabled?: boolean;
  layoutMetadata?: Record<string, { x: number; y: number; [key: string]: unknown }>;
  status?: 'ACTIVE' | 'DISABLED';
  createdDate?: string;
  updatedDate?: string;
  [key: string]: unknown;
}

export interface WorkflowDefinitionSummary {
  workflowKey: string;
  name: string;
  version: number;
  description?: string;
  tasks?: WorkflowTaskDefinition[];
  layoutMetadata?: Record<string, { x: number; y: number; [key: string]: unknown }>;
  status?: 'ACTIVE' | 'DISABLED';
  updatedAt?: string;
  [key: string]: unknown;
}
