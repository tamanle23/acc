export interface TaskPayload<T = Record<string, any>> {
  taskId: string;
  taskDefName: string;
  workflowInstanceId?: string;
  inputData: T;
}

export interface TaskExecutionResult<T = Record<string, any>> {
  status: 'COMPLETED' | 'FAILED';
  outputData: T;
  logs?: string[];
  error?: string;
}

export interface ITaskPoller {
  readonly id: string;
  start(onTask: (task: TaskPayload) => Promise<TaskExecutionResult>): Promise<void>;
  stop(): Promise<void>;
  isPolling(): boolean;
}
