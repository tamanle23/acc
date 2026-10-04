import { OrkesApiConfig, TaskManager, orkesConductorClient } from '@io-orkes/conductor-javascript';
import { TaskWorkerFactory } from './TaskWorkerFactory';
import { ConductorTaskInput } from './interfaces/IConductorTaskCommand';
import * as os from 'os';

export class ConductorWorkerPoller {
  private taskManager: TaskManager | null = null;
  private readonly workerId: string;
  private sandboxServer: any = null;

  constructor(
    private conductorServerUrl: string,
    private taskDefNames: string[],
    workerIdPrefix: string = 'acc-worker',
    private sandboxMode: boolean = false
  ) {
    this.workerId = `${workerIdPrefix}-${os.hostname()}-${process.pid}`;
  }

  public async start(): Promise<void> {
    if (this.sandboxMode) {
      await this.startSandboxServer();
      return;
    }

    const client = await orkesConductorClient({
      serverUrl: this.conductorServerUrl
    });

    // Register the workers using Conductor SDK based on the factory registry
    const workers = this.taskDefNames.map(taskDefName => ({
      taskDefName,
      execute: async (task: any) => {
        return await this.executeTask(taskDefName, task);
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

  private async executeTask(taskDefName: string, task: any) {
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

  private async startSandboxServer() {
    console.log(`[ConductorPoller Sandbox] Starting local sandbox server on port 8081...`);
    const executeTaskRef = this.executeTask.bind(this);

    this.sandboxServer = Bun.serve({
      port: 8081,
      async fetch(req) {
        const url = new URL(req.url);

        // POST /sandbox/task/:taskDefName
        if (req.method === 'POST' && url.pathname.startsWith('/sandbox/task/')) {
          const taskDefName = url.pathname.replace('/sandbox/task/', '');
          try {
              const body = await req.json();
              console.log(`[Sandbox] Executing task: ${taskDefName}`);
              const result = await executeTaskRef(taskDefName, body);
              return new Response(JSON.stringify(result), {
                  headers: { "Content-Type": "application/json" }
              });
          } catch(e: any) {
              return new Response(JSON.stringify({ error: e.message }), { status: 400 });
          }
        }

        return new Response("Not found", { status: 404 });
      }
    });
    console.log(`[ConductorPoller Sandbox] Listening at http://localhost:8081`);
    console.log(`[ConductorPoller Sandbox] Test via: curl -X POST http://localhost:8081/sandbox/task/acc.p4_story.compose_video -d '{"inputData":{"storyConfig":{"scene":1}}}'`);
  }

  public stop(): void {
    if (this.sandboxMode && this.sandboxServer) {
        console.log(`[ConductorPoller Sandbox] Stopping sandbox server...`);
        this.sandboxServer.stop(true);
        this.sandboxServer = null;
    } else if (this.taskManager) {
      console.log(`[ConductorPoller] Stopping polling...`);
      this.taskManager.stopPolling();
      this.taskManager = null;
    }
  }
}
