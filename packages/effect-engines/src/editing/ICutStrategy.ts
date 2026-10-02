import type { ExtendedContentChunk } from '@acc/ir';

export interface CutTimeRange {
  startMs: number;
  endMs: number;
  audioStartOffsetMs?: number;
  audioEndOffsetMs?: number;
}

export interface CutExecutionResult {
  chunkId: string;
  videoRange: CutTimeRange;
  audioRange: CutTimeRange;
  splitEditType?: 'j_cut' | 'l_cut' | 'standard';
}

export interface ICutStrategy {
  readonly id: string;
  calculateCut(chunk: ExtendedContentChunk): CutExecutionResult;
}

export class StandardCutStrategy implements ICutStrategy {
  public readonly id: string = 'standard_cut';

  public calculateCut(chunk: ExtendedContentChunk): CutExecutionResult {
    const duration = chunk.durationMs;
    return {
      chunkId: chunk.id,
      videoRange: { startMs: 0, endMs: duration },
      audioRange: { startMs: 0, endMs: duration },
      splitEditType: 'standard',
    };
  }
}

export class JCutLCutStrategy implements ICutStrategy {
  public readonly id: string = 'split_edit';
  private readonly offsetMs: number;
  private readonly mode: 'j_cut' | 'l_cut';

  constructor(mode: 'j_cut' | 'l_cut' = 'j_cut', offsetMs = 500) {
    this.mode = mode;
    this.offsetMs = offsetMs;
  }

  public calculateCut(chunk: ExtendedContentChunk): CutExecutionResult {
    const duration = chunk.durationMs;
    const offset = chunk.videoOffsetMs ?? this.offsetMs;

    if (this.mode === 'j_cut') {
      // J-Cut: Audio starts BEFORE video (Audio lead-in)
      return {
        chunkId: chunk.id,
        videoRange: { startMs: offset, endMs: duration },
        audioRange: { startMs: 0, endMs: duration },
        splitEditType: 'j_cut',
      };
    } else {
      // L-Cut: Video cuts away while audio from current scene CONTINUES into next scene
      return {
        chunkId: chunk.id,
        videoRange: { startMs: 0, endMs: Math.max(0, duration - offset) },
        audioRange: { startMs: 0, endMs: duration },
        splitEditType: 'l_cut',
      };
    }
  }
}

export class MatchCutStrategy implements ICutStrategy {
  public readonly id: string = 'match_cut';

  public calculateCut(chunk: ExtendedContentChunk): CutExecutionResult {
    const duration = chunk.durationMs;
    return {
      chunkId: chunk.id,
      videoRange: { startMs: 0, endMs: duration },
      audioRange: { startMs: 0, endMs: duration },
      splitEditType: 'standard',
    };
  }
}
