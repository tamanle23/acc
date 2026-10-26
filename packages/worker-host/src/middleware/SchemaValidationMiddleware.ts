import { TaskContext, TaskOutcome, WorkerMiddleware, MiddlewareNext } from '../types.js';

export interface SchemaValidator<T> {
  parse(data: unknown): T;
}

export class SchemaValidationMiddleware<T> implements WorkerMiddleware {
  constructor(private readonly validator: SchemaValidator<T> | string[]) {}

  async invoke(context: TaskContext, next: MiddlewareNext): Promise<TaskOutcome> {
    if (!context.input || typeof context.input !== 'object') {
      return TaskOutcome.failedTerminal('Task input must be a valid non-null object');
    }

    if (Array.isArray(this.validator)) {
      for (const requiredKey of this.validator) {
        if (!(requiredKey in (context.input as Record<string, unknown>))) {
          return TaskOutcome.failedTerminal(`Missing required input field: ${requiredKey}`);
        }
      }
    } else {
      try {
        this.validator.parse(context.input);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return TaskOutcome.failedTerminal(`Schema validation failed: ${msg}`);
      }
    }

    return await next(context);
  }
}
