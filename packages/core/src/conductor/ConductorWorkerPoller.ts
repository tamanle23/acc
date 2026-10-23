import { UniversalLogger as Logger } from '@acc/core-isomorphic';
import { TaskWorkerFactory } from './TaskWorkerFactory';
import { ConductorTaskInput, ConductorTaskOutput } from './interfaces/IConductorTaskCommand';
import { IConductorListenerStrategy } from './interfaces/IConductorListenerStrategy';
import { LocalSandboxListenerStrategy } from './strategies/LocalSandboxListenerStrategy';
import { OrkesConductorListenerStrategy } from './strategies/OrkesConductorListenerStrategy';
import * as os from 'os';

export class ConductorWorkerPoller {
  private readonly workerId: string;
  private readonly strategy: IConductorListenerStrategy;

  constructor(
    conductorServerUrl: string,
    taskDefNames: string[],
    workerIdPrefix: string = 'acc-worker',
    sandboxMode: boolean = false
  ) {
    this.workerId = `${workerIdPrefix}-${os.hostname()}-${process.pid}`;

    // Bind the execution callback so strategies don't need to know about the TaskWorkerFactory details
    const boundExecuteTask = this.executeTask.bind(this);

    if (sandboxMode) {
        this.strategy = new LocalSandboxListenerStrategy(8081, boundExecuteTask);
    } else {
        this.strategy = new OrkesConductorListenerStrategy(
            conductorServerUrl,
            taskDefNames,
            this.workerId,
            boundExecuteTask
        );
    }
  }

  public async start(): Promise<void> {
    await this.strategy.start();
  }

  public stop(): void {
    this.strategy.stop();
  }

  private async executeTask(taskDefName: string, task: any): Promise<ConductorTaskOutput> {
    const input: ConductorTaskInput = {
      taskId: task.taskId || `mock-${Date.now()}`,
      workflowInstanceId: task.workflowInstanceId || `mock-workflow-${Date.now()}`,
      taskDefName: task.taskDefName || taskDefName,
      inputData: task.inputData || {}
    };

    try {
      const command = TaskWorkerFactory.getCommand(taskDefName);
      command.validate(input);

      const result = await command.execute(input);

      return {
        status: result.status as any,
        outputData: result.outputData,
        logs: result.logs?.map(l => ({ log: l, createdTime: Date.now() })),
        reasonForIncompletion: result.reasonForIncompletion
      };
    } catch (err: any) {
      Logger.error('ConductorWorkerPoller', `Task ${taskDefName} failed:`, err);
      return {
        status: 'FAILED',
        reasonForIncompletion: err.message || String(err),
        outputData: {}
      };
    }
  }
}
