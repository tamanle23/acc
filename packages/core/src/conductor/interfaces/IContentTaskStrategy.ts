import { UnifiedPipelineContext } from '../../pipeline/types';

export interface IContentTaskStrategy<TInput, TOutput> {
  readonly contentTypeId: string; // e.g. "static_web_001", "video_101", "audio_151"
  readonly pipelineId: string;    // "1" through "6"
  process(ctx: UnifiedPipelineContext<TInput>): Promise<TOutput>;
}
