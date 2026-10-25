export interface WordToken {
  word: string;
  startMs: number;
  endMs: number;
  deleted?: boolean;
}

export interface CutRange {
  startMs: number;
  endMs: number;
}

export interface EditableSequence {
  id?: string;
  startFrame: number;
  durationFrames: number;
  type?: string;
  modifiers?: any[];
  [key: string]: any;
}

export class TextBasedEditingEngine {
  /**
   * Corrected cut range calculation:
   * Returns true cut intervals (contiguous ranges of words marked as deleted).
   */
  public static calculateTimelineCutsFromDeletedWords(tokens: WordToken[]): CutRange[] {
    const cutRanges: CutRange[] = [];
    let cutStart: number | null = null;
    let cutEnd = 0;

    for (const token of tokens) {
      if (token.deleted) {
        if (cutStart === null) {
          cutStart = token.startMs;
        }
        cutEnd = Math.max(cutEnd, token.endMs);
      } else {
        if (cutStart !== null) {
          cutRanges.push({ startMs: cutStart, endMs: cutEnd });
          cutStart = null;
        }
      }
    }

    if (cutStart !== null) {
      cutRanges.push({ startMs: cutStart, endMs: cutEnd });
    }

    return cutRanges;
  }

  /**
   * Returns intervals of retained words (words not marked as deleted).
   */
  public static calculateRetainedRanges(tokens: WordToken[]): CutRange[] {
    const retainedRanges: CutRange[] = [];
    let currentStart: number | null = null;
    let lastEnd = 0;

    for (const token of tokens) {
      if (!token.deleted) {
        if (currentStart === null) {
          currentStart = token.startMs;
        }
        lastEnd = Math.max(lastEnd, token.endMs);
      } else {
        if (currentStart !== null) {
          retainedRanges.push({ startMs: currentStart, endMs: lastEnd });
          currentStart = null;
        }
      }
    }

    if (currentStart !== null) {
      retainedRanges.push({ startMs: currentStart, endMs: lastEnd });
    }

    return retainedRanges;
  }

  /**
   * Transcript-to-IR Ripple Splitter:
   * Given cut ranges, splits sequences, removes cut frames, and ripples downstream timeline frames.
   */
  public static splitSequencesWithRippleCuts<T extends EditableSequence>(
    sequences: T[],
    cuts: CutRange[],
    fps: number = 30
  ): T[] {
    if (!cuts || cuts.length === 0) return [...sequences];

    // Convert cuts from ms to frames
    const cutFrames = cuts
      .map((c) => ({
        startFrame: Math.floor((c.startMs * fps) / 1000),
        endFrame: Math.ceil((c.endMs * fps) / 1000),
      }))
      .sort((a, b) => a.startFrame - b.startFrame);

    const result: T[] = [];

    for (const seq of sequences) {
      const seqStart = seq.startFrame;
      const seqEnd = seqStart + seq.durationFrames;

      let currentCursor = seqStart;

      for (const cut of cutFrames) {
        if (cut.endFrame <= currentCursor || cut.startFrame >= seqEnd) {
          continue; // Cut is outside current sequence segment
        }

        if (cut.startFrame > currentCursor) {
          // Retain piece before cut
          const duration = cut.startFrame - currentCursor;
          result.push({
            ...seq,
            id: seq.id ? `${seq.id}_seg_${currentCursor}` : undefined,
            startFrame: currentCursor,
            durationFrames: duration,
          });
        }

        currentCursor = Math.max(currentCursor, cut.endFrame);
      }

      if (currentCursor < seqEnd) {
        // Retain piece after all cuts
        result.push({
          ...seq,
          id: seq.id ? `${seq.id}_seg_${currentCursor}` : undefined,
          startFrame: currentCursor,
          durationFrames: seqEnd - currentCursor,
        });
      }
    }

    // Ripple downstream offsets
    let rippleShift = 0;
    const finalSequences: T[] = [];

    for (let i = 0; i < result.length; i++) {
      const current = result[i];
      if (i > 0) {
        const prev = result[i - 1];
        const gap = current.startFrame - (prev.startFrame + prev.durationFrames);
        if (gap > 0) {
          rippleShift += gap;
        }
      }
      finalSequences.push({
        ...current,
        startFrame: Math.max(0, current.startFrame - rippleShift),
      });
    }

    return finalSequences;
  }
}
