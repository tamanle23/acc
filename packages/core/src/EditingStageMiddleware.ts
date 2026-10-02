import type { ExtendedPipelineIR } from '@acc/ir';

export interface EditingStageContext {
  ir: ExtendedPipelineIR;
  intermediateFiles: string[];
  filterGraphParts: string[];
  metadata: Record<string, unknown>;
}

export type EditingStageNextFunction = () => Promise<void>;

export interface IEditingStageMiddleware {
  readonly name: string;
  execute(ctx: EditingStageContext, next: EditingStageNextFunction): Promise<void>;
}

export class EditingStageRunner {
  private middlewares: IEditingStageMiddleware[] = [];

  public use(middleware: IEditingStageMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  public async run(ctx: EditingStageContext): Promise<void> {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      if (i === this.middlewares.length) return;

      const middleware = this.middlewares[i];
      try {
        await middleware.execute(ctx, () => dispatch(i + 1));
      } catch (err) {
        console.warn(`[EditingStageRunner] Middleware [${middleware.name}] failed. Applying graceful fallback:`, err);
        // Fallback boundary: continue pipeline to next stage
        await dispatch(i + 1);
      }
    };

    await dispatch(0);
  }
}
