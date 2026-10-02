import type { IPipelineMiddleware } from '../../PipelineRunner';
import type { UnifiedPipelineContext } from '../UnifiedPipelineContext';
import { Logger } from '../../logger';

export interface ConcurrencyGate {
  acquire(): Promise<() => void>;
  activeCount(): number;
}

export function createConcurrencyGate(maxConcurrent: number): ConcurrencyGate {
  let active = 0;
  const waiting: Array<() => void> = [];

  return {
    async acquire(): Promise<() => void> {
      if (active < maxConcurrent) {
        active++;
        let released = false;
        return () => {
          if (!released) {
            released = true;
            active--;
            const next = waiting.shift();
            if (next) {
              active++;
              next();
            }
          }
        };
      }

      await new Promise<void>((resolve) => waiting.push(resolve));
      let released = false;
      return () => {
        if (!released) {
          released = true;
          active--;
          const next = waiting.shift();
          if (next) {
            active++;
            next();
          }
        }
      };
    },
    activeCount(): number {
      return active;
    },
  };
}

// Global default GPU task semaphore (prevents concurrent VRAM exhaustion)
export const defaultGPUSemaphore = createConcurrencyGate(1);

export function createBoundedExecutionMiddleware<TInput = any>(
  middleware: IPipelineMiddleware<UnifiedPipelineContext<TInput>>,
  gate: ConcurrencyGate = defaultGPUSemaphore
): IPipelineMiddleware<UnifiedPipelineContext<TInput>> {
  return {
    name: `bounded(${middleware.name})`,
    async execute(ctx: UnifiedPipelineContext<TInput>, next: () => Promise<void>): Promise<void> {
      Logger.debug('BoundedExecution', `Acquiring concurrency slot for stage [${middleware.name}]`);
      const release = await gate.acquire();
      try {
        await middleware.execute(ctx, next);
      } finally {
        release();
        Logger.debug('BoundedExecution', `Released concurrency slot for stage [${middleware.name}]`);
      }
    },
  };
}
