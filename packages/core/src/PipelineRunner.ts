import { AssetContext } from './AssetContext';
import { VFXCommand } from './VFXCommand';
import { Logger } from './logger';

export interface PipelineContext {
  storyId: string;
  baseDir: string;
  assets: AssetContext;
  vfxQueue: VFXCommand[];
  metadata: Record<string, any>;
  errors: Array<{ stage: string; error: Error }>;
  timings?: Record<string, number>;
  [key: string]: any;
}

export interface IPipelineMiddleware<TContext extends PipelineContext = PipelineContext> {
  name: string;
  execute(ctx: TContext, next: () => Promise<void>): Promise<void>;
}

export class PipelineRunner<TContext extends PipelineContext = PipelineContext> {
  private middlewares: IPipelineMiddleware<TContext>[] = [];

  public use(middleware: IPipelineMiddleware<TContext>): this {
    this.middlewares.push(middleware);
    return this;
  }

  public getMiddlewares(): IPipelineMiddleware<TContext>[] {
    return [...this.middlewares];
  }

  public async run(ctx: TContext): Promise<TContext> {
    const storyIdentifier = ctx.storyId || (ctx as any).pipelineId || 'unknown';
    Logger.info('PipelineRunner', `Starting pipeline execution for story [${storyIdentifier}]`);
    let index = -1;

    if (!ctx.timings) {
      ctx.timings = {};
    }

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error('next() called multiple times in middleware chain');
      }
      index = i;

      if (i === this.middlewares.length) {
        return;
      }

      const mw = this.middlewares[i];
      Logger.debug('PipelineRunner', `Executing middleware stage: ${mw.name}`);
      const stageStartTime = Date.now();

      try {
        await mw.execute(ctx, () => dispatch(i + 1));
      } catch (err: any) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        Logger.error('PipelineRunner', `Fault in middleware [${mw.name}]: ${errorObj.message}`);
        ctx.errors.push({ stage: mw.name, error: errorObj });

        // Defensive Fault Isolation: Continue pipeline execution to allow fallbacks to process
        await dispatch(i + 1);
      } finally {
        ctx.timings![mw.name] = Date.now() - stageStartTime;
      }
    };

    await dispatch(0);
    Logger.info('PipelineRunner', `Pipeline [${storyIdentifier}] completed with ${ctx.errors.length} stage error(s).`);
    return ctx;
  }
}
