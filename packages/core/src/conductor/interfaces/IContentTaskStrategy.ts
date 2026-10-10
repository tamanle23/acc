import { UnifiedPipelineContext } from '../../pipeline/UnifiedPipelineContext';
import type { PipelineIR } from '@acc/ir';
import type { VideoIRDocument } from '@acc/ir';
import type { StaticWebOutput } from '../strategies/archetypes/StaticWebContentStrategy';
import type { SocialMediaOutput } from '../strategies/archetypes/SocialMediaContentStrategy';
import type { VideoContentOutput } from '../strategies/archetypes/VideoContentStrategy';
import type { AudioPodcastOutput } from '../strategies/archetypes/AudioPodcastContentStrategy';
import type { InteractiveWebOutput } from '../strategies/archetypes/InteractiveWebContentStrategy';

export type ContentModality = 'static-web' | 'social' | 'video' | 'audio' | 'interactive-web';

/**
 * OmnichannelOutput:
 * Unified polymorphic output payload representing the fan-out of a single
 * content domain strategy into any combination of requested modalities.
 */
export interface OmnichannelOutput {
  readonly contentTypeId: string;
  readonly pipelineId: string;
  readonly ir: PipelineIR;
  readonly requestedModalities: ContentModality[];
  readonly deliverables: {
    staticWeb?: StaticWebOutput;
    social?: SocialMediaOutput;
    video?: VideoContentOutput;
    audio?: AudioPodcastOutput;
    interactiveWeb?: InteractiveWebOutput;
  };
  readonly timestamp: number;
}

export interface IContentTaskStrategy<TInput = any, TOutput = OmnichannelOutput> {
  readonly contentTypeId: string;
  readonly pipelineId: string;
  readonly defaultModality: ContentModality;
  readonly supportedModalities: ContentModality[];
  readonly feasibilityTier: 'Tier A' | 'Tier B' | 'Tier C' | 'Tier D';
  readonly interventionStage: 'Before' | 'In the Middle' | 'After';

  /**
   * Primary entry point: Generates normalized PipelineIR and fans out
   * to any combination of requested modalities (or defaults to all supported).
   */
  process(ctx: UnifiedPipelineContext<TInput>): Promise<TOutput>;
}
