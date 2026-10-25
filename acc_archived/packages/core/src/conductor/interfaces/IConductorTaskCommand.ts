export interface ConductorTaskInput<T = Record<string, unknown>> {
  taskId: string;
  workflowInstanceId: string;
  taskDefName: string;
  inputData: T;
}

export interface ConductorTaskOutput<T = Record<string, unknown>> {
  status: 'COMPLETED' | 'FAILED' | 'IN_PROGRESS';
  outputData: T;
  logs?: string[];
  reasonForIncompletion?: string;
}

export interface IConductorTaskCommand<TInput = any, TOutput = any> {
  readonly taskDefName: string;
  validate(input: ConductorTaskInput<TInput>): void;
  execute(input: ConductorTaskInput<TInput>): Promise<ConductorTaskOutput<TOutput>>;
  rollback?(input: ConductorTaskInput<TInput>, error: Error): Promise<void>;
}
