import { UnifiedPipelineContext } from '@acc/core/pipeline';
import { BaseContentTaskStrategy, StrategyDescriptor } from '../BaseContentTaskStrategy';
import type { PipelineIR } from '@acc/ir';

export interface AudioPodcastOutput {
  contentTypeId: string;
  pipelineId: string;
  targetModality: 'audio';
  audioComposition: PipelineIR['audioComposition'];
  ir: PipelineIR;
  audioSpecs: {
    format: 'mp3' | 'wav' | 'flac' | 'aac';
    sampleRate: number;
    channels: number;
    loudnessLufs: number;
    durationMs: number;
    hasBgm: boolean;
    sfxCount: number;
  };
  timestamp: number;
}

export class AudioPodcastContentStrategy extends BaseContentTaskStrategy<any, AudioPodcastOutput> {
  constructor(descriptor: StrategyDescriptor) {
    super({
      ...descriptor,
      targetModality: 'audio',
    });
  }

  protected override async produceOutput(
    ctx: UnifiedPipelineContext<any>,
    ir: PipelineIR
  ): Promise<AudioPodcastOutput> {
    const durationMs = ir.chunks[0]?.durationMs || 60000;
    const format = (ctx.input as any)?.audioFormat || 'mp3';

    // Strict Architectural Constraint: Audio outputs bypass Universal Video IR directly
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
        loudnessLufs: -14.0, // EBU R128 Podcast Standard
        durationMs,
        hasBgm: Boolean(ir.audioComposition?.backgroundMusic),
        sfxCount: ir.audioComposition?.sfxMarkers?.length || 0,
      },
      timestamp: Date.now(),
    };
  }
}
