import type {
  ITimelineStrategy,
  CaptionConfig,
  CaptionTrackSnapshot,
  CaptionWordState,
  CaptionSettings,
} from '../types';

export interface CaptionStrategyOptions extends CaptionSettings {
  leadInOffsetSec?: number;
  maxHoldDecaySec?: number;
}

export class BoundedAcousticCaptionStrategy implements ITimelineStrategy<CaptionConfig, CaptionTrackSnapshot> {
  public readonly strategyId = 'bounded-acoustic-caption-v1';

  constructor(
    private defaultLeadInSec: number = 0.05,
    private defaultMaxHoldSec: number = 0.04
  ) {}

  public groupPhrases(captions: CaptionConfig[], wordsPerPhrase: number): CaptionConfig[][] {
    if (wordsPerPhrase <= 1) {
      return captions.map(c => [c]);
    }

    const phrases: CaptionConfig[][] = [];
    let current: CaptionConfig[] = [];

    for (let i = 0; i < captions.length; i++) {
      const item = captions[i];
      current.push(item);

      const isPunctuation = /[.!?]$/.test(item.text.trim());
      const next = captions[i + 1];
      const isLongPause = next && (next.start - item.end) > 0.4;

      if (current.length >= wordsPerPhrase || isPunctuation || isLongPause) {
        phrases.push(current);
        current = [];
      }
    }

    if (current.length > 0) {
      phrases.push(current);
    }

    return phrases;
  }

  private phraseCache = new WeakMap<CaptionConfig[], Map<number, CaptionConfig[][]>>();

  public getGroupedPhrases(captions: CaptionConfig[], wordsPerPhrase: number): CaptionConfig[][] {
    let perPhraseMap = this.phraseCache.get(captions);
    if (!perPhraseMap) {
      perPhraseMap = new Map();
      this.phraseCache.set(captions, perPhraseMap);
    }
    let cached = perPhraseMap.get(wordsPerPhrase);
    if (!cached) {
      cached = this.groupPhrases(captions, wordsPerPhrase);
      perPhraseMap.set(wordsPerPhrase, cached);
    }
    return cached;
  }

  public evaluate(
    items: CaptionConfig[],
    localTimeSec: number,
    options?: CaptionStrategyOptions
  ): CaptionTrackSnapshot {
    if (!items || items.length === 0) {
      return {
        activePhraseIndex: -1,
        phrase: null,
        activeWord: null,
        isInSpeechPause: true,
        shouldRender: false,
      };
    }

    const wordsPerPhrase = options?.wordsPerPhrase ?? 1;
    // Allow user override from settings.timeOffset, else fallback to configured default (50ms)
    const leadInSec = options?.timeOffset !== undefined
      ? options.timeOffset
      : (options?.leadInOffsetSec ?? this.defaultLeadInSec);
    const maxHoldSec = options?.maxHoldDecaySec ?? this.defaultMaxHoldSec;

    const phrases = this.getGroupedPhrases(items, wordsPerPhrase);

    let foundPhraseIndex = -1;
    let activePhrase: CaptionConfig[] | null = null;

    // Phrase selection: Visible from (firstWord.start - leadIn) to (lastWord.end + 0.12)
    for (let pIdx = 0; pIdx < phrases.length; pIdx++) {
      const p = phrases[pIdx];
      const pStart = p[0].start;
      const pEnd = p[p.length - 1].end;

      if (localTimeSec >= (pStart - leadInSec) && localTimeSec <= (pEnd + 0.12)) {
        foundPhraseIndex = pIdx;
        activePhrase = p;
        break;
      }
    }

    if (!activePhrase) {
      return {
        activePhraseIndex: -1,
        phrase: null,
        activeWord: null,
        isInSpeechPause: true,
        shouldRender: false,
      };
    }

    // Word highlight evaluation with strict pause boundary clearance
    let activeWordState: CaptionWordState | null = null;
    let inPause = true;

    for (let wIdx = 0; wIdx < activePhrase.length; wIdx++) {
      const w = activePhrase[wIdx];
      const nextW = activePhrase[wIdx + 1];
      const gap = nextW ? Math.max(0, nextW.start - w.end) : 0;

      // Allow hold decay into silence, capped to at most half the gap
      const holdDecay = Math.min(maxHoldSec, gap * 0.5);

      const effectiveStart = w.start - leadInSec;
      const effectiveEnd = w.end + holdDecay;

      if (localTimeSec >= effectiveStart && localTimeSec <= effectiveEnd) {
        const duration = Math.max(0.01, w.end - w.start);
        const progress = Math.min(1.0, Math.max(0.0, (localTimeSec - w.start) / duration));
        activeWordState = {
          wordIndex: wIdx,
          word: w,
          isActive: true,
          progress,
        };
        inPause = false;
        break;
      }
    }

    return {
      activePhraseIndex: foundPhraseIndex,
      phrase: activePhrase,
      activeWord: activeWordState,
      isInSpeechPause: inPause,
      shouldRender: true,
    };
  }
}
