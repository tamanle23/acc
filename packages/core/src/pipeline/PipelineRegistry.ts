import type { IPipeline, PipelineExecutionOptions } from './IPipeline';
import type { UnifiedPipelineContext } from './UnifiedPipelineContext';
import { Logger } from '../logger';

export interface PipelineSummary {
  id: string;
  name: string;
  description?: string;
  aliases: string[];
}

export class PipelineRegistry {
  private static instance: PipelineRegistry;
  private pipelines: Map<string, IPipeline> = new Map();
  private aliases: Map<string, string> = new Map();
  private pipelineAliases: Map<string, Set<string>> = new Map();

  private constructor() {}

  public static getInstance(): PipelineRegistry {
    if (!PipelineRegistry.instance) {
      PipelineRegistry.instance = new PipelineRegistry();
    }
    return PipelineRegistry.instance;
  }

  public register(pipeline: IPipeline, aliases: string[] = []): this {
    this.pipelines.set(pipeline.id, pipeline);

    if (!this.pipelineAliases.has(pipeline.id)) {
      this.pipelineAliases.set(pipeline.id, new Set());
    }

    for (const alias of aliases) {
      const norm = alias.toLowerCase();
      this.aliases.set(norm, pipeline.id);
      this.pipelineAliases.get(pipeline.id)!.add(norm);
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

  public getAliases(pipelineId: string): string[] {
    const aliasSet = this.pipelineAliases.get(pipelineId);
    return aliasSet ? Array.from(aliasSet) : [];
  }

  public getSummaries(): PipelineSummary[] {
    return this.list().map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      aliases: this.getAliases(p.id),
    }));
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
