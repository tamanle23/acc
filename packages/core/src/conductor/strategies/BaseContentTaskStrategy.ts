import type { PipelineIR, ContentChunk } from '@acc/ir';
import type { UnifiedPipelineContext } from '../../pipeline/UnifiedPipelineContext';
import type { IContentTaskStrategy } from '../interfaces/IContentTaskStrategy';

export interface StrategyDescriptor {
  readonly contentTypeId: string;
  readonly pipelineId: string;
  readonly targetModality: 'static-web' | 'social' | 'video' | 'audio' | 'interactive-web';
  readonly feasibilityTier: 'Tier A' | 'Tier B' | 'Tier C' | 'Tier D';
  readonly interventionStage: 'Before' | 'In the Middle' | 'After';
  readonly defaultTitle: string;
  readonly summaryTemplate: (input: any) => string;
}

/**
 * BaseContentTaskStrategy:
 * Template Method Pattern providing unified pipeline processing,
 * parameter validation, and PipelineIR generation across all 250 content variations.
 */
export abstract class BaseContentTaskStrategy<TInput = any, TOutput = any>
  implements IContentTaskStrategy<TInput, TOutput>
{
  constructor(protected readonly descriptor: StrategyDescriptor) {}

  public get contentTypeId(): string {
    return this.descriptor.contentTypeId;
  }

  public get pipelineId(): string {
    return this.descriptor.pipelineId;
  }

  public get targetModality(): 'static-web' | 'social' | 'video' | 'audio' | 'interactive-web' {
    return this.descriptor.targetModality;
  }

  public get feasibilityTier(): 'Tier A' | 'Tier B' | 'Tier C' | 'Tier D' {
    return this.descriptor.feasibilityTier;
  }

  public get interventionStage(): 'Before' | 'In the Middle' | 'After' {
    return this.descriptor.interventionStage;
  }

  public get descriptorMeta(): StrategyDescriptor {
    return this.descriptor;
  }

  /**
   * Primary Template Method executing parameter validation,
   * building normalized PipelineIR, and producing the strategy output.
   */
  public async process(ctx: UnifiedPipelineContext<TInput>): Promise<TOutput> {
    this.validateInput(ctx.input);
    const ir = await this.buildPipelineIR(ctx);
    return this.produceOutput(ctx, ir);
  }

  protected validateInput(input: TInput): void {
    if (!input) {
      throw new Error(`[${this.contentTypeId}] Empty input provided to content strategy`);
    }
  }

  /**
   * Constructs the normalized PipelineIR payload for this content variation.
   */
  protected async buildPipelineIR(ctx: UnifiedPipelineContext<TInput>): Promise<PipelineIR> {
    const input = ctx.input as any;
    const summaryText = this.descriptor.summaryTemplate(input);
    const title = input?.title || this.descriptor.defaultTitle;

    const chunk: ContentChunk = {
      id: `chunk_${this.contentTypeId}_0`,
      order: 0,
      text: summaryText,
      durationMs: input?.durationMs || 5000,
      metadata: {
        contentTypeId: this.contentTypeId,
        interventionStage: this.interventionStage,
        feasibilityTier: this.feasibilityTier,
        customParams: input?.customParams || {},
      },
    };

    const pipelineMap: Record<string, PipelineIR['pipelineId']> = {
      '1': 'scraper-summarizer',
      '2': 'db-templating',
      '3': 'repurposing-recycler',
      '4': 'generative-storytelling',
      '5': 'rule-logic',
      '6': 'ambient-loops',
    };

    return {
      schemaVersion: '3.0.0',
      pipelineId: pipelineMap[this.pipelineId] || 'scraper-summarizer',
      metadata: {
        jobId: ctx.metadata?.workflowInstanceId || `job_${Date.now()}`,
        title,
        createdAt: new Date().toISOString(),
        tags: [this.pipelineId, this.targetModality, this.contentTypeId],
      },
      chunks: [chunk],
      audioComposition: {
        ducking: {
          enabled: true,
          attenuationDb: -16,
          attackMs: 20,
          releaseMs: 250,
        },
        sfxMarkers: [],
      },
      structuredData: input?.structuredData || {},
      distributionHints: {
        supportedExporters: [this.targetModality as any],
        targetAspectRatios: ['9:16', '16:9'],
      },
    };
  }

  /**
   * Hook for subclasses or base default handler to transform PipelineIR into output.
   */
  protected async produceOutput(
    ctx: UnifiedPipelineContext<TInput>,
    ir: PipelineIR
  ): Promise<TOutput> {
    return {
      contentTypeId: this.contentTypeId,
      pipelineId: this.pipelineId,
      targetModality: this.targetModality,
      ir,
      timestamp: Date.now(),
    } as unknown as TOutput;
  }
}
