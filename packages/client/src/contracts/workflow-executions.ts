// ==========================================
// Workflow Execution & Telemetry Contracts
// ==========================================

export type WorkflowExecutionStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'SKIPPED'
  | 'TERMINATED'
  | 'PAUSED'
  | 'PENDING'
  | 'RUNNING'
  // Legacy / backlog mappings
  | 'backlog'
  | 'todo'
  | 'in progress'
  | 'done'
  | 'canceled';

export interface ApprovalTask {
  id: string;
  taskId: string;
  workflowId: string;
  workflowKey: string;
  workflowName?: string;
  taskReferenceName: string;
  status: 'WAITING_FOR_APPROVAL' | 'COMPLETED' | 'FAILED';
  assignee?: string;
  role?: string;
  instructions?: string;
  slaMinutes?: number;
  createdAt: string;
  dueAt?: string;
  claimedBy?: string | null;
  claimedAt?: string | number | null;
  slaBreached?: boolean;
  decision?: 'APPROVED' | 'REJECTED';
  decisionComment?: string;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
}

export interface ApprovalDecisionRequest {
  action: 'APPROVE' | 'REJECT';
  comment?: string;
  formData?: Record<string, unknown>;
}

export interface TaskSnapshot {
  taskId: string;
  workflowId: string;
  taskReferenceName: string;
  taskType: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'WAITING_FOR_APPROVAL' | 'COMPLETED' | 'FAILED' | 'TIMED_OUT' | 'SKIPPED';
  leaseOwner?: string | null;
  attempt?: number;
  maxRetries?: number;
  pollDomain?: string;
  durationMs?: number;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  error?: string;
  errorMessage?: string;
  startTimeEpochMs?: number;
  endTimeEpochMs?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  [key: string]: unknown;
}

export interface WorkflowSnapshot {
  workflowId: string;
  tenantId: string;
  workspaceId?: string;
  workflowKey: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TERMINATED' | 'TIMED_OUT';
  currentStep?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  tasksByRef?: Record<string, TaskSnapshot>;
  startTimeEpochMs?: number;
  endTimeEpochMs?: number;
  startedAt?: string;
  completedAt?: string;
  [key: string]: unknown;
}

export type WorkflowExecutionSnapshot = WorkflowSnapshot;

export interface WorkflowExecution {
  id: string;
  taskId?: string;
  title: string;
  status: WorkflowExecutionStatus;
  label?: string;
  priority?: string;
  workflowId?: string;
  workflowName?: string;
  activeStep?: string;
  taskReferenceName?: string;
  taskType?: string;
  leaseOwner?: string | null;
  attempt?: number;
  maxRetries?: number;
  pollDomain?: string;
  visibleAtEpochMs?: number;
  durationMs?: number;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  [key: string]: unknown;
}

export interface StartWorkflowRequest {
  workflowKey: string;
  input?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TerminateExecutionRequest {
  reason?: string;
  [key: string]: unknown;
}

export interface CompensateExecutionRequest {
  reason?: string;
  [key: string]: unknown;
}

export interface PollTasksRequest {
  taskType?: string;
  domain?: string;
  workerId?: string;
  batchSize?: number;
}

export interface UpdateTaskStatusRequest {
  taskId: string;
  workflowId: string;
  status: 'COMPLETED' | 'FAILED';
  outputData?: Record<string, unknown>;
  error?: string;
  [key: string]: unknown;
}

export interface ExecutionSseEvent {
  event: 'WORKFLOW_STARTED' | 'TASK_UPDATED' | 'WORKFLOW_COMPLETED' | 'WORKFLOW_TERMINATED' | string;
  data: {
    workflowId: string;
    status: string;
    workflowKey?: string;
    timestamp?: number;
    reason?: string;
    task?: TaskSnapshot;
    [key: string]: unknown;
  };
}
