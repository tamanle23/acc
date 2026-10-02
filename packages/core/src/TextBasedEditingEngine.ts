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

export class TextBasedEditingEngine {
  public static calculateTimelineCutsFromDeletedWords(tokens: WordToken[]): CutRange[] {
    const retainedRanges: CutRange[] = [];
    let currentStart: number | null = null;
    let lastEnd = 0;

    for (const token of tokens) {
      if (!token.deleted) {
        if (currentStart === null) {
          currentStart = token.startMs;
        }
        lastEnd = token.endMs;
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
}
