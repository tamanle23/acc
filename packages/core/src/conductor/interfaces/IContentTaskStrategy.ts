import { UnifiedPipelineContext } from '../../pipeline/UnifiedPipelineContext';

export interface IContentTaskStrategy<TInput = any, TOutput = any> {
  readonly contentTypeId: string; // e.g. "item_001_daily_industry_digest", "item_042_barchart_race"
  readonly pipelineId: string;    // "1" through "6"
  readonly targetModality: 'static-web' | 'social' | 'video' | 'audio' | 'interactive-web';
  readonly feasibilityTier: 'Tier A' | 'Tier B' | 'Tier C' | 'Tier D';
  readonly interventionStage: 'Before' | 'In the Middle' | 'After';
  process(ctx: UnifiedPipelineContext<TInput>): Promise<TOutput>;
}
