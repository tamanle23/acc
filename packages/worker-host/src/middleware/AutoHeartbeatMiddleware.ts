import { TaskContext, TaskOutcome, WorkerMiddleware, MiddlewareNext } from '../types.js';

export class AutoHeartbeatMiddleware implements WorkerMiddleware {
  constructor(private readonly intervalMs: number = 10000) {}

  async invoke(context: TaskContext, next: MiddlewareNext): Promise<TaskOutcome> {
    const timer = setInterval(() => {
      context.heartbeat().catch((err) => {
        context.log(`AutoHeartbeat failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, this.intervalMs);

    try {
      return await next(context);
    } finally {
      clearInterval(timer);
    }
  }
}
