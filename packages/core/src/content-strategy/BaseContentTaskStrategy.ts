import type { PipelineIR, ContentChunk, VideoIRDocument, FineGrainedVideoDirectorConfig } from '@acc/ir';
import { PipelineIRToUniversalIRAdapter } from '@acc/ir';
import type { StaticWebOutput } from './archetypes/StaticWebContentStrategy';
import type { SocialMediaOutput } from './archetypes/SocialMediaContentStrategy';
import type { VideoContentOutput } from './archetypes/VideoContentStrategy';
import type { AudioPodcastOutput } from './archetypes/AudioPodcastContentStrategy';
import type { InteractiveWebOutput } from './archetypes/InteractiveWebContentStrategy';
import { UnifiedPipelineContext } from '../pipeline';

export interface StrategyDescriptor {
  readonly contentTypeId: string;
  readonly pipelineId: string;
  readonly targetModality?: ContentModality;
  readonly defaultModality?: ContentModality;
  readonly supportedModalities?: ContentModality[];
  readonly feasibilityTier: 'Tier A' | 'Tier B' | 'Tier C' | 'Tier D';
  readonly interventionStage: 'Before' | 'In the Middle' | 'After';
  readonly defaultTitle: string;
  readonly summaryTemplate: (input: any) => string;
}
export type ContentModality = 'static-web' | 'social' | 'video' | 'audio' | 'interactive-web';
export const ALL_MODALITIES: ContentModality[] = [
  'static-web',
  'social',
  'video',
  'audio',
  'interactive-web',
];

export interface IContentTaskStrategy<TInput, TOutput> {
  readonly contentTypeId: string; // e.g. "static_web_001", "video_101", "audio_151"
  readonly pipelineId: string;    // "1" through "6"
  process(ctx: UnifiedPipelineContext<TInput>): Promise<TOutput>;
}

/**
 * BaseContentTaskStrategy:
 * Template Method Pattern implementing TRUE 1-to-N Omnichannel Fan-out.
 * Accepts domain input, constructs rich canonical PipelineIR, and can produce
 * any combination of Static Web, Social, Video, Audio, and Interactive deliverables.
 */
export abstract class BaseContentTaskStrategy<TInput = any, TOutput = any>
  implements IContentTaskStrategy<TInput, TOutput> {
  public readonly defaultModality: ContentModality;
  public readonly supportedModalities: ContentModality[];

  constructor(protected readonly descriptor: StrategyDescriptor) {
    this.defaultModality = descriptor.defaultModality || descriptor.targetModality || 'video';
    this.supportedModalities = descriptor.supportedModalities || ALL_MODALITIES;
  }

  public get contentTypeId(): string {
    return this.descriptor.contentTypeId;
  }

  public get pipelineId(): string {
    return this.descriptor.pipelineId;
  }

  public get targetModality(): ContentModality {
    return this.defaultModality;
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
   * building normalized PipelineIR, and fanning out to requested modalities.
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
   * Constructs the normalized PipelineIR payload for this domain topic.
   */
  protected async buildPipelineIR(ctx: UnifiedPipelineContext<TInput>): Promise<PipelineIR> {
    const input = ctx.input as any;
    const summaryText = this.descriptor.summaryTemplate(input);
    const title = input?.title || this.descriptor.defaultTitle;

    const chunk: ContentChunk = {
      id: `chunk_${this.contentTypeId}_0`,
      order: 0,
      text: summaryText,
      spokenAudioPath: input?.spokenAudioPath,
      durationMs: input?.durationMs || 15000,
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
        tags: [this.pipelineId, this.defaultModality, this.contentTypeId],
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
        supportedExporters: (this.supportedModalities as any) || ['video', 'social', 'static-web', 'audio'],
        targetAspectRatios: ['9:16', '16:9'],
      },
    };
  }

  /**
   * Produces the full omnichannel payload containing all requested modality deliverables.
   */
  protected abstract produceOutput(
    ctx: UnifiedPipelineContext<TInput>,
    ir: PipelineIR
  ): Promise<TOutput>;
}
