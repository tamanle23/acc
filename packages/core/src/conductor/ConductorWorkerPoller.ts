import { OrkesApiConfig, TaskManager, orkesConductorClient } from '@io-orkes/conductor-javascript';
import { TaskWorkerFactory } from './TaskWorkerFactory';
import { ConductorTaskInput } from './interfaces/IConductorTaskCommand';
import * as os from 'os';

export class ConductorWorkerPoller {
  private taskManager: TaskManager | null = null;
  private readonly workerId: string;

  constructor(
    private conductorServerUrl: string,
    private taskDefNames: string[],
    workerIdPrefix: string = 'acc-worker'
  ) {
    this.workerId = `${workerIdPrefix}-${os.hostname()}-${process.pid}`;
  }

  public async start(): Promise<void> {
    const client = await orkesConductorClient({
      serverUrl: this.conductorServerUrl
    });

    // Register the workers using Conductor SDK based on the factory registry
    const workers = this.taskDefNames.map(taskDefName => ({
      taskDefName,
      execute: async (task: any) => {
        const input: ConductorTaskInput = {
          taskId: task.taskId,
          workflowInstanceId: task.workflowInstanceId,
          taskDefName: task.taskDefName,
          inputData: task.inputData || {}
        };

        try {
          const command = TaskWorkerFactory.getCommand(taskDefName);
          command.validate(input);

          const result = await command.execute(input);

          return {
            status: result.status,
            outputData: result.outputData,
            logs: result.logs?.map(l => ({ log: l, createdTime: Date.now() })),
            reasonForIncompletion: result.reasonForIncompletion
          };
        } catch (err: any) {
          console.error(`[ConductorPoller] Task ${taskDefName} failed:`, err);
          return {
            status: 'FAILED',
            reasonForIncompletion: err.message || String(err),
            outputData: {}
          };
        }
      }
    }));

    this.taskManager = new TaskManager(client, workers, {
      logger: console,
      options: {
         workerID: this.workerId,
         pollInterval: 1000,
         concurrency: 5
      }
    });

    console.log(`[ConductorPoller] Starting polling on ${this.conductorServerUrl} with ${workers.length} task definitions...`);
    this.taskManager.startPolling();
  }

  public stop(): void {
    if (this.taskManager) {
      console.log(`[ConductorPoller] Stopping polling...`);
      this.taskManager.stopPolling();
    }
  }
}
