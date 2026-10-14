import {
  SimpleTaskHandler,
  TaskHandler,
  TaskOutcome,
  WorkerConfig,
  WorkerMiddleware,
  WorkerTransportClient,
} from '../types.js';
import { TaskPoller } from './TaskPoller.js';

export class WorkflowWorkerHost {
  private readonly middlewares: WorkerMiddleware[] = [];
  private readonly pollers = new Map<string, TaskPoller>();
  private readonly abortController = new AbortController();
  private started = false;

  constructor(
    private readonly transport: WorkerTransportClient,
    private readonly workerId: string = `worker-${Math.random().toString(36).slice(2, 9)}`
  ) {}

  /** Attach composable middleware (Validation, Heartbeat, Metrics) */
  use(middleware: WorkerMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /** Register task handler with full Conductor control (TaskOutcome) */
  register<TInput = Record<string, unknown>>(
    config: WorkerConfig,
    handler: TaskHandler<TInput>
  ): this {
    const fullConfig: Required<WorkerConfig> = {
      taskType: config.taskType,
      tenantId: config.tenantId ?? 'system',
      domain: config.domain ?? 'default',
      maxConcurrency: config.maxConcurrency ?? 10,
      basePollIntervalMs: config.basePollIntervalMs ?? 50,
      maxPollIntervalMs: config.maxPollIntervalMs ?? 2000,
      pollBatchSize: config.pollBatchSize ?? 5,
      autoHeartbeatIntervalMs: config.autoHeartbeatIntervalMs ?? 10000,
    };

    const poller = new TaskPoller(
      fullConfig,
      handler as TaskHandler,
      this.middlewares,
      this.transport,
      this.workerId,
      this.abortController
    );

    this.pollers.set(config.taskType, poller);
    if (this.started) {
      poller.start();
    }
    return this;
  }

  /** Register ergonomic shorthand returning output object directly */
  registerSimple<TInput = Record<string, unknown>, TOutput = Record<string, unknown>>(
    taskType: string,
    handler: SimpleTaskHandler<TInput, TOutput>,
    options?: Partial<WorkerConfig>
  ): this {
    return this.register(
      {
        taskType,
        ...options,
      },
      async (ctx) => {
        const output = await handler(ctx as any);
        return TaskOutcome.completed((output ?? {}) as Record<string, unknown>);
      }
    );
  }

  /** Start background polling loops across all registered task types */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    for (const poller of this.pollers.values()) {
      poller.start();
    }
  }

  /** Graceful shutdown: ceases polling and aborts active workers */
  async shutdown(): Promise<void> {
    this.abortController.abort();
    for (const poller of this.pollers.values()) {
      poller.stop();
    }
    this.pollers.clear();
  }
}
