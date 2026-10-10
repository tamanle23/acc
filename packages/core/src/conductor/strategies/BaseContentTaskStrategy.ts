import type { PipelineIR, ContentChunk, VideoIRDocument } from '@acc/ir';
import { PipelineIRToUniversalIRAdapter } from '@acc/ir';
import type { UnifiedPipelineContext } from '../../pipeline/UnifiedPipelineContext';
import type {
  IContentTaskStrategy,
  ContentModality,
  OmnichannelOutput,
} from '../interfaces/IContentTaskStrategy';
import type { StaticWebOutput } from './archetypes/StaticWebContentStrategy';
import type { SocialMediaOutput } from './archetypes/SocialMediaContentStrategy';
import type { VideoContentOutput } from './archetypes/VideoContentStrategy';
import type { AudioPodcastOutput } from './archetypes/AudioPodcastContentStrategy';
import type { InteractiveWebOutput } from './archetypes/InteractiveWebContentStrategy';

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

export const ALL_MODALITIES: ContentModality[] = [
  'static-web',
  'social',
  'video',
  'audio',
  'interactive-web',
];

/**
 * BaseContentTaskStrategy:
 * Template Method Pattern implementing TRUE 1-to-N Omnichannel Fan-out.
 * Accepts domain input, constructs rich canonical PipelineIR, and can produce
 * any combination of Static Web, Social, Video, Audio, and Interactive deliverables.
 */
export class BaseContentTaskStrategy<TInput = any, TOutput = OmnichannelOutput>
  implements IContentTaskStrategy<TInput, TOutput>
{
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
    return this.produceOmnichannelOutput(ctx, ir);
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
  protected async produceOmnichannelOutput(
    ctx: UnifiedPipelineContext<TInput>,
    ir: PipelineIR
  ): Promise<TOutput> {
    const input = ctx.input as any;
    const requestedModalities: ContentModality[] = Array.isArray(input?.modalities) && input.modalities.length > 0
      ? input.modalities
      : [this.defaultModality];

    const deliverables: OmnichannelOutput['deliverables'] = {};

    for (const mod of requestedModalities) {
      switch (mod) {
        case 'static-web':
          deliverables.staticWeb = this.renderStaticWeb(ctx, ir);
          break;
        case 'social':
          deliverables.social = this.renderSocial(ctx, ir);
          break;
        case 'video':
          deliverables.video = this.renderVideo(ctx, ir);
          break;
        case 'audio':
          deliverables.audio = this.renderAudio(ctx, ir);
          break;
        case 'interactive-web':
          deliverables.interactiveWeb = this.renderInteractive(ctx, ir);
          break;
      }
    }

    const output: OmnichannelOutput = {
      contentTypeId: this.contentTypeId,
      pipelineId: this.pipelineId,
      ir,
      requestedModalities,
      deliverables,
      timestamp: Date.now(),
    };

    // Maintain backward-compatible property getters for single-modality callers
    return Object.assign(output, {
      ...deliverables.staticWeb,
      ...deliverables.social,
      ...deliverables.video,
      ...deliverables.audio,
      ...deliverables.interactiveWeb,
    }) as unknown as TOutput;
  }

  // --- Modality Rendering Sub-Routines ---

  protected renderStaticWeb(ctx: UnifiedPipelineContext<TInput>, ir: PipelineIR): StaticWebOutput {
    const title = ir.metadata.title;
    const bodyText = ir.chunks[0]?.text || '';
    const keywords = (ir.metadata.tags || []).concat(['cms', 'ssg', 'static-web']);

    return {
      contentTypeId: this.contentTypeId,
      pipelineId: this.pipelineId,
      targetModality: 'static-web',
      markdown: `# ${title}\n\n${bodyText}\n\n*Generated by ACC Strategy: ${this.contentTypeId}*`,
      html: `<article class="acc-article" data-content-id="${this.contentTypeId}"><h1>${title}</h1><p>${bodyText}</p></article>`,
      ir,
      seoMetadata: {
        title,
        description: bodyText.slice(0, 160),
        keywords,
      },
      timestamp: Date.now(),
    };
  }

  protected renderSocial(ctx: UnifiedPipelineContext<TInput>, ir: PipelineIR): SocialMediaOutput {
    const title = ir.metadata.title;
    const bodyText = ir.chunks[0]?.text || '';
    const tags = ir.metadata.tags || [];
    const hashtags = tags.map((t) => `#${t.replace(/[^a-zA-Z0-9]/g, '')}`).concat(['#ACC', '#ContentAI']);

    return {
      contentTypeId: this.contentTypeId,
      pipelineId: this.pipelineId,
      targetModality: 'social',
      threadTweets: [
        `🚨 ${title}\n\n${bodyText.slice(0, 180)}... 🧵👇`,
        `Key Takeaway:\n${bodyText}\n\nWhat do you think? Drop your perspective below! 👇`,
        `Follow for automated daily updates on this topic! ${hashtags.join(' ')}`,
      ],
      linkedinPost: `📌 **${title}**\n\n${bodyText}\n\n💡 Insights & Analysis:\nAutomated via ACC Multi-Pipeline Engine.\n\n${hashtags.join(' ')}`,
      quoteCard: {
        headline: title,
        subheading: bodyText.slice(0, 100),
        hashtags,
        backgroundColor: '#1E293B',
      },
      ir,
      timestamp: Date.now(),
    };
  }

  protected renderVideo(ctx: UnifiedPipelineContext<TInput>, ir: PipelineIR): VideoContentOutput {
    const requestedAspect = (ctx.input as any)?.aspectRatio;
    const aspectRatio: '9:16' | '16:9' = requestedAspect === '16:9' ? '16:9' : '9:16';
    const durationMs = ir.chunks[0]?.durationMs || 15000;

    const videoIRDoc = PipelineIRToUniversalIRAdapter.adapt(
      ir,
      ctx.metadata?.workflowInstanceId || `video_${this.contentTypeId}_${Date.now()}`
    );

    return {
      contentTypeId: this.contentTypeId,
      pipelineId: this.pipelineId,
      targetModality: 'video',
      videoIRDoc,
      ir,
      videoSettings: {
        aspectRatio,
        fps: videoIRDoc.meta.globalFps || 30,
        durationMs,
        hasVoiceover: Boolean(ir.chunks[0]?.spokenAudioPath),
        hasSubtitles: true,
      },
      timestamp: Date.now(),
    };
  }

  protected renderAudio(ctx: UnifiedPipelineContext<TInput>, ir: PipelineIR): AudioPodcastOutput {
    const durationMs = ir.chunks[0]?.durationMs || 60000;
    const format = (ctx.input as any)?.audioFormat || 'mp3';

    return {
      contentTypeId: this.contentTypeId,
      pipelineId: this.pipelineId,
      targetModality: 'audio',
      audioComposition: ir.audioComposition,
      ir,
      audioSpecs: {
        format,
        sampleRate: 48000,
        channels: 2,
        loudnessLufs: -14.0,
        durationMs,
        hasBgm: Boolean(ir.audioComposition?.backgroundMusic),
        sfxCount: ir.audioComposition?.sfxMarkers?.length || 0,
      },
      timestamp: Date.now(),
    };
  }

  protected renderInteractive(ctx: UnifiedPipelineContext<TInput>, ir: PipelineIR): InteractiveWebOutput {
    const input = ctx.input as any;
    const title = ir.metadata.title;
    const summary = ir.chunks[0]?.text || '';

    let widgetType: InteractiveWebOutput['widgetType'] = 'calculator';
    if (this.pipelineId === '4') widgetType = 'html5_game';
    else if (this.pipelineId === '2') widgetType = 'd3_chart';
    else if (this.pipelineId === '5') widgetType = 'calculator';
    else if (this.pipelineId === '1') widgetType = 'scrollytelling';

    const html = `<div id="acc-widget-${this.contentTypeId}" class="acc-interactive-widget" data-type="${widgetType}"><h2>${title}</h2><div class="widget-viewport"></div></div>`;
    const jsBundle = `/* ACC Interactive Bundle: ${this.contentTypeId} */ (function(){ console.log("Initializing ${widgetType}: ${title}"); })();`;

    return {
      contentTypeId: this.contentTypeId,
      pipelineId: this.pipelineId,
      targetModality: 'interactive-web',
      widgetType,
      bundlePayload: {
        html,
        jsBundle,
        initialState: input?.initialState || { title, summary },
      },
      ir,
      timestamp: Date.now(),
    };
  }
}
