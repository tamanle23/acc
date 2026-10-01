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
}

export interface IPipelineMiddleware {
  name: string;
  execute(ctx: PipelineContext, next: () => Promise<void>): Promise<void>;
}

export class PipelineRunner {
  private middlewares: IPipelineMiddleware[] = [];

  public use(middleware: IPipelineMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  public getMiddlewares(): IPipelineMiddleware[] {
    return [...this.middlewares];
  }

  public async run(ctx: PipelineContext): Promise<PipelineContext> {
    Logger.info('PipelineRunner', `Starting pipeline execution for story [${ctx.storyId}]`);
    let index = -1;

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

      try {
        await mw.execute(ctx, () => dispatch(i + 1));
      } catch (err: any) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        Logger.error('PipelineRunner', `Fault in middleware [${mw.name}]: ${errorObj.message}`);
        ctx.errors.push({ stage: mw.name, error: errorObj });

        // Defensive Fault Isolation: Continue pipeline execution to allow fallbacks to process
        await dispatch(i + 1);
      }
    };

    await dispatch(0);
    Logger.info('PipelineRunner', `Pipeline [${ctx.storyId}] completed with ${ctx.errors.length} stage error(s).`);
    return ctx;
  }
}
