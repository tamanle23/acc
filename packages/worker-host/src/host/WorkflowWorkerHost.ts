import {
  SimpleTaskHandler,
  TaskHandler,
  TaskOutcome,
  TaskWorkerDescriptor,
  WorkerConfig,
  WorkerMiddleware,
  WorkerTransportClient,
} from '../types.js';
import { TaskPoller } from './TaskPoller.js';

export class WorkflowWorkerHost {
  private readonly middlewares: WorkerMiddleware[] = [];
  private readonly pollers = new Map<string, TaskPoller>();
  private readonly descriptors = new Map<string, TaskWorkerDescriptor>();
  private readonly abortController = new AbortController();
  private fleetHeartbeatTimer?: ReturnType<typeof setInterval>;
  private started = false;
  private startedAtMs = Date.now();
  private completedCount = 0;
  private errorCount = 0;

  constructor(
    private readonly transport: WorkerTransportClient,
    private readonly workerId: string = `worker-${Math.random().toString(36).slice(2, 9)}`
  ) {}

  public getWorkerId(): string {
    return this.workerId;
  }

  public getRegisteredDescriptors(): TaskWorkerDescriptor[] {
    return Array.from(this.descriptors.values());
  }

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
      description: config.description ?? `TypeScript worker for ${config.taskType}`,
      maxConcurrency: config.maxConcurrency ?? 10,
      timeoutSeconds: config.timeoutSeconds ?? 30,
      inputSchema: config.inputSchema ?? { type: 'object' },
      outputSchema: config.outputSchema ?? { type: 'object' },
      basePollIntervalMs: config.basePollIntervalMs ?? 50,
      maxPollIntervalMs: config.maxPollIntervalMs ?? 2000,
      pollBatchSize: config.pollBatchSize ?? 5,
      autoHeartbeatIntervalMs: config.autoHeartbeatIntervalMs ?? 10000,
    };

    const descriptor: TaskWorkerDescriptor = {
      taskName: fullConfig.taskType,
      domain: fullConfig.domain,
      description: fullConfig.description,
      maxConcurrency: fullConfig.maxConcurrency,
      timeoutSeconds: fullConfig.timeoutSeconds,
      inputSchema: fullConfig.inputSchema,
      outputSchema: fullConfig.outputSchema,
    };
    this.descriptors.set(`${fullConfig.domain}:${fullConfig.taskType}`, descriptor);

    const wrappedHandler: TaskHandler = async (ctx) => {
      try {
        const res = await (handler as TaskHandler)(ctx);
        if (res.status === 'COMPLETED') {
          this.completedCount++;
        } else if (res.status === 'FAILED') {
          this.errorCount++;
        }
        return res;
      } catch (err) {
        this.errorCount++;
        throw err;
      }
    };

    const poller = new TaskPoller(
      fullConfig,
      wrappedHandler,
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

  /** Start background polling loops across all registered task types and announce capabilities */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.startedAtMs = Date.now();

    const capabilities = this.getRegisteredDescriptors();
    const pollDomains = Array.from(new Set(capabilities.map((c) => c.domain)));
    const concurrencyLimit = capabilities.reduce((sum, c) => sum + c.maxConcurrency, 0) || 10;

    if (this.transport.registerWorker) {
      await this.transport.registerWorker({
        workerId: this.workerId,
        runtime: 'NODEJS_WORKER',
        pollDomains: pollDomains.length > 0 ? pollDomains : ['default'],
        concurrencyLimit,
        capabilities,
      });
    }

    for (const poller of this.pollers.values()) {
      poller.start();
    }

    if (this.transport.sendFleetHeartbeat) {
      this.fleetHeartbeatTimer = setInterval(() => {
        if (!this.started) return;
        const uptimeSeconds = Math.max(1, Math.floor((Date.now() - this.startedAtMs) / 1000));
        this.transport
          .sendFleetHeartbeat?.({
            workerId: this.workerId,
            runtime: 'NODEJS_WORKER',
            pollDomains: pollDomains.length > 0 ? pollDomains : ['default'],
            concurrencyLimit,
            activeLeases: 0,
            tasksCompletedCount: this.completedCount,
            errorCount: this.errorCount,
            uptimeSeconds,
            capabilities,
          })
          .catch(() => {});
      }, 10000);
    }
  }

  /** Graceful shutdown: ceases polling and aborts active workers */
  async shutdown(): Promise<void> {
    this.started = false;
    if (this.fleetHeartbeatTimer) {
      clearInterval(this.fleetHeartbeatTimer);
      this.fleetHeartbeatTimer = undefined;
    }
    this.abortController.abort();
    for (const poller of this.pollers.values()) {
      poller.stop();
    }
    this.pollers.clear();
  }
}
