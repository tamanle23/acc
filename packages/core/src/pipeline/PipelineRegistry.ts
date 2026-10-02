import type { IPipeline, PipelineExecutionOptions } from './IPipeline';
import type { UnifiedPipelineContext } from './UnifiedPipelineContext';
import { Logger } from '../logger';

export class PipelineRegistry {
  private static instance: PipelineRegistry;
  private pipelines: Map<string, IPipeline> = new Map();
  private aliases: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): PipelineRegistry {
    if (!PipelineRegistry.instance) {
      PipelineRegistry.instance = new PipelineRegistry();
    }
    return PipelineRegistry.instance;
  }

  public register(pipeline: IPipeline, aliases: string[] = []): this {
    this.pipelines.set(pipeline.id, pipeline);
    for (const alias of aliases) {
      this.aliases.set(alias.toLowerCase(), pipeline.id);
    }
    Logger.debug('PipelineRegistry', `Registered pipeline [${pipeline.id}] with aliases: [${aliases.join(', ')}]`);
    return this;
  }

  public get(idOrAlias: string): IPipeline | undefined {
    const normalized = idOrAlias.toLowerCase();
    if (this.pipelines.has(normalized)) {
      return this.pipelines.get(normalized);
    }
    const resolvedId = this.aliases.get(normalized);
    if (resolvedId && this.pipelines.has(resolvedId)) {
      return this.pipelines.get(resolvedId);
    }
    return undefined;
  }

  public has(idOrAlias: string): boolean {
    return this.get(idOrAlias) !== undefined;
  }

  public list(): IPipeline[] {
    return Array.from(this.pipelines.values());
  }

  public async execute(
    idOrAlias: string,
    input: any,
    options?: PipelineExecutionOptions
  ): Promise<UnifiedPipelineContext> {
    const pipeline = this.get(idOrAlias);
    if (!pipeline) {
      throw new Error(`Pipeline '${idOrAlias}' not found in registry.`);
    }
    return pipeline.execute(input, options);
  }
}

export const defaultPipelineRegistry = PipelineRegistry.getInstance();
