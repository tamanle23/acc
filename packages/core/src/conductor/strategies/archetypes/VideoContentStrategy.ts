import { BaseContentTaskStrategy, StrategyDescriptor } from '../BaseContentTaskStrategy';
import type { UnifiedPipelineContext } from '../../../pipeline/UnifiedPipelineContext';
import type { PipelineIR } from '@acc/ir';
import type { VideoIRDocument } from '@acc/ir';
import { PipelineIRToUniversalIRAdapter } from '@acc/ir';

export interface VideoContentOutput {
  contentTypeId: string;
  pipelineId: string;
  targetModality: 'video';
  videoIRDoc: VideoIRDocument;
  ir: PipelineIR;
  videoSettings: {
    aspectRatio: '9:16' | '16:9';
    fps: number;
    durationMs: number;
    hasVoiceover: boolean;
    hasSubtitles: boolean;
  };
  timestamp: number;
}

export class VideoContentStrategy extends BaseContentTaskStrategy<any, VideoContentOutput> {
  constructor(descriptor: StrategyDescriptor) {
    super({
      ...descriptor,
      targetModality: 'video',
    });
  }

  protected override async produceOutput(
    ctx: UnifiedPipelineContext<any>,
    ir: PipelineIR
  ): Promise<VideoContentOutput> {
    const requestedAspect = (ctx.input as any)?.aspectRatio;
    const aspectRatio: '9:16' | '16:9' = requestedAspect === '16:9' ? '16:9' : '9:16';
    const durationMs = ir.chunks[0]?.durationMs || 15000;

    // Direct compilation into Universal Video IR (Strict Phase 4 Constraint)
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
}
