import {
  TaskContext,
  TaskHandler,
  TaskOutcome,
  TaskSnapshotDto,
  WorkerConfig,
  WorkerMiddleware,
  WorkerTransportClient,
} from '../types.js';
import { ConcurrencyLimiter } from './ConcurrencyLimiter.js';

export class TaskPoller {
  private running = false;
  private readonly limiter: ConcurrencyLimiter;
  private pollerTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly config: Required<WorkerConfig>,
    private readonly handler: TaskHandler,
    private readonly middlewares: WorkerMiddleware[],
    private readonly transport: WorkerTransportClient,
    private readonly workerId: string,
    private readonly abortController: AbortController
  ) {
    this.limiter = new ConcurrencyLimiter(config.maxConcurrency);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNextPoll(0);
  }

  stop(): void {
    this.running = false;
    if (this.pollerTimer) {
      clearTimeout(this.pollerTimer);
      this.pollerTimer = undefined;
    }
  }

  private scheduleNextPoll(delayMs: number): void {
    if (!this.running) return;
    this.pollerTimer = setTimeout(() => {
      this.pollAndExecute().catch(() => {
        this.scheduleNextPoll(this.config.basePollIntervalMs);
      });
    }, delayMs);
  }

  private async pollAndExecute(): Promise<void> {
    if (!this.running) return;

    const permits = this.limiter.availablePermits;
    if (permits <= 0) {
      this.scheduleNextPoll(this.config.basePollIntervalMs);
      return;
    }

    const batchSize = Math.min(permits, this.config.pollBatchSize);
    let tasks: TaskSnapshotDto[] = [];

    try {
      tasks = await this.transport.pollBatch(
        this.config.tenantId,
        this.config.taskType,
        this.config.domain,
        batchSize,
        this.workerId
      );
    } catch (err) {
      this.scheduleNextPoll(this.config.basePollIntervalMs * 2);
      return;
    }

    if (tasks.length > 0) {
      for (const task of tasks) {
        this.executeTaskWithLimiter(task);
      }
      // Burst draining: schedule immediately
      this.scheduleNextPoll(0);
    } else {
      // Exponential backoff
      this.scheduleNextPoll(this.config.basePollIntervalMs);
    }
  }

  private executeTaskWithLimiter(task: TaskSnapshotDto): void {
    this.limiter
      .acquire()
      .then((release) => {
        return this.executeTask(task).finally(() => release());
      })
      .catch(() => {});
  }

  private async executeTask(task: TaskSnapshotDto): Promise<void> {
    const logs: string[] = [];
    const taskAbort = new AbortController();

    // Link host shutdown abort
    if (this.abortController.signal.aborted) {
      taskAbort.abort();
    } else {
      this.abortController.signal.addEventListener('abort', () => taskAbort.abort(), { once: true });
    }

    const context: TaskContext = {
      taskId: task.taskId,
      workflowId: task.taskId.split('_')[0],
      tenantId: this.config.tenantId,
      workspaceId: 'default',
      taskType: task.taskType,
      referenceName: task.taskReferenceName,
      domain: task.domain,
      attempt: task.attempt,
      input: task.inputData,
      log: (msg: string) => {
        logs.push(`${Date.now()}: ${msg}`);
      },
      getLogs: () => [...logs],
      heartbeat: async () => {
        await this.transport.heartbeat(task.taskId, this.workerId);
      },
      signal: taskAbort.signal,
    };

    try {
      const outcome = await this.runMiddlewareChain(0, context);

      if (outcome.status === 'COMPLETED') {
        await this.transport.reportTaskResult(
          task.taskId,
          this.workerId,
          true,
          outcome.output ?? {},
          undefined,
          0
        );
      } else if (outcome.status === 'IN_PROGRESS') {
        await this.transport.reportTaskResult(
          task.taskId,
          this.workerId,
          false,
          outcome.partialOutput ?? {},
          undefined,
          outcome.callbackAfterSeconds
        );
      } else if (outcome.status === 'FAILED') {
        await this.transport.reportTaskResult(
          task.taskId,
          this.workerId,
          false,
          outcome.output ?? {},
          outcome.errorMessage,
          0
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.transport.reportTaskResult(
        task.taskId,
        this.workerId,
        false,
        {},
        msg,
        0
      );
    }
  }

  private async runMiddlewareChain(index: number, context: TaskContext): Promise<TaskOutcome> {
    if (index < this.middlewares.length) {
      const mw = this.middlewares[index];
      return await mw.invoke(context, (ctx) => this.runMiddlewareChain(index + 1, ctx));
    }
    return await this.handler(context);
  }
}
