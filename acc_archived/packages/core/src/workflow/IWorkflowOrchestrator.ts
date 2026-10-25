export type WorkflowStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TERMINATED' | 'PAUSED';

export interface WorkflowTaskDefinition<TInput = any, TOutput = any> {
  taskId: string;
  taskType: string;
  workflowInstanceId: string;
  input: TInput;
  output?: TOutput;
}

export interface IWorkflowOrchestrator {
  registerWorker(
    taskType: string,
    handler: (task: WorkflowTaskDefinition) => Promise<any>
  ): Promise<void>;
  startWorkflow(
    workflowName: string,
    correlationId: string,
    input: any
  ): Promise<string>;
  getWorkflowStatus(workflowInstanceId: string): Promise<WorkflowStatus>;
  terminateWorkflow(workflowInstanceId: string, reason: string): Promise<void>;
}
