import { AssetContext } from './AssetContext';
import { VFXCommand } from './VFXCommand';
import { Logger } from './logger';
import { DeadLetterQueue } from './saga/SagaOrchestrator';

export interface PipelineContext {
  storyId: string;
  baseDir: string;
  assets: AssetContext;
  vfxQueue: VFXCommand[];
  metadata: Record<string, any>;
  errors: Array<{ stage: string; error: Error }>;
  timings?: Record<string, number>;
  signal?: AbortSignal;
  [key: string]: any;
}

export interface IPipelineMiddleware<TContext extends PipelineContext = PipelineContext> {
  name: string;
  execute(ctx: TContext, next: () => Promise<void>): Promise<void>;
  compensate?: (ctx: TContext, error: Error) => Promise<void>;
}

export interface PipelineRunnerHooks<TContext extends PipelineContext = PipelineContext> {
  onStageStart?: (stageName: string, ctx: TContext) => void | Promise<void>;
  onStageSuccess?: (stageName: string, durationMs: number, ctx: TContext) => void | Promise<void>;
  onStageError?: (stageName: string, error: Error, ctx: TContext) => void | Promise<void>;
}

export class PipelineRunner<TContext extends PipelineContext = PipelineContext> {
  private middlewares: IPipelineMiddleware<TContext>[] = [];
  private hooks: PipelineRunnerHooks<TContext> = {};

  public use(middleware: IPipelineMiddleware<TContext>): this {
    this.middlewares.push(middleware);
    return this;
  }

  public tap(name: string, fn: (ctx: TContext) => void | Promise<void>): this {
    this.middlewares.push({
      name: `tap:${name}`,
      execute: async (ctx, next) => {
        await fn(ctx);
        await next();
      },
    });
    return this;
  }

  public setHooks(hooks: PipelineRunnerHooks<TContext>): this {
    this.hooks = { ...this.hooks, ...hooks };
    return this;
  }

  public getMiddlewares(): IPipelineMiddleware<TContext>[] {
    return [...this.middlewares];
  }

  public async runWithSaga(ctx: TContext): Promise<TContext> {
    return this.run(ctx, { enableSagaCompensation: true });
  }

  public async run(ctx: TContext, options: { enableSagaCompensation?: boolean } = {}): Promise<TContext> {
    const storyIdentifier = ctx.storyId || (ctx as any).pipelineId || 'unknown';
    Logger.info('PipelineRunner', `Starting pipeline execution for story [${storyIdentifier}]`);
    let index = -1;
    let compensationTriggered = false;
    const startedMiddlewares: IPipelineMiddleware<TContext>[] = [];

    if (!ctx.timings) {
      ctx.timings = {};
    }

    const triggerCompensation = async (error: Error, failedStageName: string) => {
      if (!options.enableSagaCompensation || compensationTriggered) return;
      compensationTriggered = true;
      Logger.error('PipelineRunner', `Triggering reverse SAGA compensation starting from [${failedStageName}]...`);
      let compStatus: 'COMPENSATED' | 'COMPENSATION_FAILED' = 'COMPENSATED';

      for (let j = startedMiddlewares.length - 1; j >= 0; j--) {
        const mw = startedMiddlewares[j];
        if (mw.compensate) {
          try {
            Logger.info('PipelineRunner', `Compensating middleware [${mw.name}]...`);
            await mw.compensate(ctx, error);
          } catch (compErr: any) {
            compStatus = 'COMPENSATION_FAILED';
            Logger.error('PipelineRunner', `Failed compensating middleware [${mw.name}]: ${compErr.message}`);
          }
        }
      }

      DeadLetterQueue.getInstance().enqueue({
        sagaId: `pipeline_${storyIdentifier}`,
        stepName: failedStageName,
        timestamp: new Date().toISOString(),
        errorPayload: {
          message: error.message,
          stack: error.stack,
        },
        contextSnapshot: { storyId: storyIdentifier, metadata: ctx.metadata },
        compensationStatus: compStatus,
      });
    };

    const dispatch = async (i: number): Promise<void> => {
      if (ctx.signal?.aborted) {
        const abortErr = new Error(`Pipeline execution aborted: ${ctx.signal.reason || 'aborted by caller'}`);
        await triggerCompensation(abortErr, 'abort_signal');
        throw abortErr;
      }

      if (i <= index) {
        throw new Error('next() called multiple times in middleware chain');
      }
      index = i;

      if (i === this.middlewares.length) {
        return;
      }

      const mw = this.middlewares[i];
      startedMiddlewares.push(mw);
      Logger.debug('PipelineRunner', `Executing middleware stage: ${mw.name}`);
      const stageStartTime = Date.now();

      if (this.hooks.onStageStart) {
        try {
          await this.hooks.onStageStart(mw.name, ctx);
        } catch (hookErr: any) {
          Logger.warn('PipelineRunner', `onStageStart hook error for [${mw.name}]: ${hookErr.message}`);
        }
      }

      try {
        await mw.execute(ctx, () => dispatch(i + 1));
        const durationMs = Date.now() - stageStartTime;
        ctx.timings![mw.name] = durationMs;

        if (this.hooks.onStageSuccess) {
          try {
            await this.hooks.onStageSuccess(mw.name, durationMs, ctx);
          } catch (hookErr: any) {
            Logger.warn('PipelineRunner', `onStageSuccess hook error for [${mw.name}]: ${hookErr.message}`);
          }
        }
      } catch (err: any) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        const durationMs = Date.now() - stageStartTime;
        ctx.timings![mw.name] = durationMs;

        Logger.error('PipelineRunner', `Fault in middleware [${mw.name}]: ${errorObj.message}`);
        ctx.errors.push({ stage: mw.name, error: errorObj });

        if (options.enableSagaCompensation) {
          await triggerCompensation(errorObj, mw.name);
          throw errorObj;
        }

        if (this.hooks.onStageError) {
          try {
            await this.hooks.onStageError(mw.name, errorObj, ctx);
          } catch (hookErr: any) {
            Logger.warn('PipelineRunner', `onStageError hook error for [${mw.name}]: ${hookErr.message}`);
          }
        }

        // Defensive Fault Isolation: Continue pipeline execution to allow fallbacks to process
        await dispatch(i + 1);
      }
    };

    await dispatch(0);
    Logger.info('PipelineRunner', `Pipeline [${storyIdentifier}] completed with ${ctx.errors.length} stage error(s).`);
    return ctx;
  }
}
