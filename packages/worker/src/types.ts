export type TaskStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'SKIPPED';

export type TaskOutcome =
  | { status: 'COMPLETED'; output?: Record<string, unknown> }
  | { status: 'IN_PROGRESS'; callbackAfterSeconds: number; partialOutput?: Record<string, unknown> }
  | { status: 'FAILED'; errorMessage: string; retryable: boolean; output?: Record<string, unknown> };

export const TaskOutcome = {
  completed: (output?: Record<string, unknown>): TaskOutcome => ({
    status: 'COMPLETED',
    output: output ?? {},
  }),
  inProgress: (callbackAfterSeconds: number, partialOutput?: Record<string, unknown>): TaskOutcome => ({
    status: 'IN_PROGRESS',
    callbackAfterSeconds,
    partialOutput: partialOutput ?? {},
  }),
  failedRetryable: (errorMessage: string, output?: Record<string, unknown>): TaskOutcome => ({
    status: 'FAILED',
    errorMessage,
    retryable: true,
    output: output ?? {},
  }),
  failedTerminal: (errorMessage: string, output?: Record<string, unknown>): TaskOutcome => ({
    status: 'FAILED',
    errorMessage,
    retryable: false,
    output: output ?? {},
  }),
};

export interface TaskContext<TInput = Record<string, unknown>> {
  readonly taskId: string;
  readonly workflowId: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly taskType: string;
  readonly referenceName: string;
  readonly domain: string;
  readonly attempt: number;
  readonly input: TInput;
  readonly traceparent?: string;

  /** Appends a timestamped log to the remote task execution audit trail */
  log(message: string): void;
  getLogs(): readonly string[];

  /** Manually signals to the engine that the task is still processing, extending the lease */
  heartbeat(): Promise<void>;

  /** AbortSignal triggered if the task lease expires or the worker host shuts down */
  readonly signal: AbortSignal;
}

export type TaskHandler<TInput = Record<string, unknown>> = (
  context: TaskContext<TInput>
) => Promise<TaskOutcome> | TaskOutcome;

export type SimpleTaskHandler<TInput = Record<string, unknown>, TOutput = Record<string, unknown>> = (
  context: TaskContext<TInput>
) => Promise<TOutput> | TOutput;

export interface WorkerConfig {
  taskType: string;
  tenantId?: string;
  domain?: string;
  maxConcurrency?: number;          // Default: 10
  basePollIntervalMs?: number;      // Default: 100ms
  maxPollIntervalMs?: number;       // Default: 3000ms
  pollBatchSize?: number;           // Default: 5
  autoHeartbeatIntervalMs?: number; // Default: 10000ms (10s)
}

export interface TaskSnapshotDto {
  taskId: string;
  taskReferenceName: string;
  taskType: string;
  domain: string;
  status: TaskStatus;
  attempt: number;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  errorMessage?: string;
  visibleAtEpochMs: number;
  responseTimeoutMs: number;
  workerId?: string;
}

export interface WorkerTransportClient {
  pollBatch(
    tenantId: string,
    taskType: string,
    domain: string,
    batchSize: number,
    workerId: string
  ): Promise<TaskSnapshotDto[]>;

  reportTaskResult(
    taskId: string,
    workerId: string,
    completed: boolean,
    output: Record<string, unknown>,
    errorMessage?: string,
    callbackAfterSeconds?: number
  ): Promise<void>;

  heartbeat(taskId: string, workerId: string): Promise<boolean>;
}

export type MiddlewareNext = (context: TaskContext) => Promise<TaskOutcome>;

export interface WorkerMiddleware {
  invoke(context: TaskContext, next: MiddlewareNext): Promise<TaskOutcome>;
}
