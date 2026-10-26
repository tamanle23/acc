import { TaskContext, TaskOutcome, WorkerMiddleware, MiddlewareNext } from '../types.js';

export class ErrorClassificationMiddleware implements WorkerMiddleware {
  async invoke(context: TaskContext, next: MiddlewareNext): Promise<TaskOutcome> {
    try {
      return await next(context);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTerminal =
        err instanceof TypeError ||
        (err as Record<string, unknown>)?.['name'] === 'ZodError' ||
        msg.includes('IllegalArgument') ||
        msg.includes('Missing required');

      if (isTerminal) {
        return TaskOutcome.failedTerminal(`Terminal error: ${msg}`);
      } else {
        return TaskOutcome.failedRetryable(`Retryable error: ${msg}`);
      }
    }
  }
}
