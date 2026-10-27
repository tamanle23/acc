import { ExtendedContentChunk } from '@acc/ir';
import type { ICutStrategy, CutExecutionResult } from './ICutStrategy';

export class SmashCutStrategy implements ICutStrategy {
  public readonly id: string = 'smash_cut';

  public calculateCut(chunk: ExtendedContentChunk): CutExecutionResult {
    return {
      chunkId: chunk.id,
      videoRange: { startMs: 0, endMs: chunk.durationMs },
      audioRange: { startMs: 0, endMs: chunk.durationMs },
      splitEditType: 'standard',
    };
  }

  public generateFFmpegAudioGainStep(previousVolumeLufs = -24, currentVolumeLufs = -12): string {
    const gainDeltaDb = currentVolumeLufs - previousVolumeLufs;
    return `volume=${gainDeltaDb.toFixed(1)}dB`;
  }
}
