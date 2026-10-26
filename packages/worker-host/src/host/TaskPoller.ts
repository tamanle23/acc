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
  private consecutiveEmptyPolls = 0;

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
    this.consecutiveEmptyPolls = 0;
    this.scheduleNextPoll(0);
  }

  stop(): void {
    this.running = false;
    if (this.pollerTimer) {
      clearTimeout(this.pollerTimer);
      this.pollerTimer = undefined;
    }
  }

  public calculateJitteredBackoff(emptyCount = this.consecutiveEmptyPolls): number {
    const base = this.config.basePollIntervalMs || 500;
    const max = this.config.maxPollIntervalMs || 5000;
    const exponent = Math.min(6, emptyCount);
    const interval = Math.min(max, base * Math.pow(2, exponent));
    const jitter = Math.random() * (interval * 0.2); // +20% randomized jitter
    return Math.floor(interval + jitter);
  }

  private scheduleNextPoll(delayMs: number): void {
    if (!this.running) return;
    this.pollerTimer = setTimeout(() => {
      this.pollAndExecute().catch(() => {
        this.consecutiveEmptyPolls++;
        const backoff = this.calculateJitteredBackoff();
        this.scheduleNextPoll(backoff);
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
      this.consecutiveEmptyPolls++;
      const delay = this.calculateJitteredBackoff();
      this.scheduleNextPoll(delay);
      return;
    }

    if (tasks.length > 0) {
      this.consecutiveEmptyPolls = 0;
      for (const task of tasks) {
        this.executeTaskWithLimiter(task);
      }
      // Burst draining: schedule immediately
      this.scheduleNextPoll(0);
    } else {
      // Exponential jittered backoff on empty poll
      this.consecutiveEmptyPolls++;
      const delay = this.calculateJitteredBackoff();
      this.scheduleNextPoll(delay);
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

    const resolveWorkflowId = (): string => {
      if (task.workflowId) return task.workflowId;
      if (task.taskReferenceName) {
        const marker = `_${task.taskReferenceName}`;
        const idx = task.taskId.lastIndexOf(marker);
        if (idx > 0) {
          return task.taskId.slice(0, idx);
        }
      }
      const lastUnderscore = task.taskId.lastIndexOf('_');
      return lastUnderscore > 0 ? task.taskId.slice(0, lastUnderscore) : task.taskId;
    };

    const context: TaskContext = {
      taskId: task.taskId,
      workflowId: resolveWorkflowId(),
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
