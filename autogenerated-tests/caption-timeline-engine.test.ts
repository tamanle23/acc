import { describe, it, expect } from 'bun:test';
import { TimelineEngine } from '../packages/core/src/timeline/TimelineEngine';
import { BoundedAcousticCaptionStrategy } from '../packages/effect-engines/src/subtitles/BoundedAcousticCaptionStrategy';
import type { CaptionConfig, CaptionTrackSnapshot } from '../packages/core/src/types';

describe('Multi-Track TimelineEngine & BoundedAcousticCaptionStrategy Invariants', () => {
  it('should initialize TimelineEngine and register tracks cleanly', () => {
    const engine = new TimelineEngine();
    const strategy = new BoundedAcousticCaptionStrategy();

    engine.addTrack({
      id: 'subtitles',
      type: 'caption',
      items: [{ text: 'Hello', start: 1.0, end: 2.0 }],
      strategy,
      duration: 3.0,
    });

    const track = engine.getTrack('subtitles');
    expect(track).toBeDefined();
    expect(track?.id).toBe('subtitles');
    expect(track?.duration).toBe(3.0);
  });

  it('Invariant: should return shouldRender=false when no captions are provided', () => {
    const engine = new TimelineEngine();
    const strategy = new BoundedAcousticCaptionStrategy();

    engine.addTrack<CaptionConfig, CaptionTrackSnapshot>({
      id: 'subtitles',
      type: 'caption',
      items: [],
      strategy,
      duration: 5.0,
    });

    const state = engine.getTrackState<CaptionTrackSnapshot>('subtitles', 1.0);
    expect(state.shouldRender).toBe(false);
    expect(state.phrase).toBeNull();
    expect(state.activeWord).toBeNull();
  });

  it('Invariant: Acoustic lead-in activates highlight within lead-in window, not earlier', () => {
    const strategy = new BoundedAcousticCaptionStrategy(0.05, 0.04); // 50ms lead-in
    const captions: CaptionConfig[] = [
      { text: 'Start', start: 1.0, end: 1.5 }
    ];

    // At t = 0.90 (100ms before): too early, word should NOT be active
    const earlyState = strategy.evaluate(captions, 0.90);
    expect(earlyState.activeWord).toBeNull();

    // At t = 0.96 (40ms before): inside the 50ms lead-in window, word should be active
    const leadInState = strategy.evaluate(captions, 0.96);
    expect(leadInState.activeWord).not.toBeNull();
    expect(leadInState.activeWord?.isActive).toBe(true);
    expect(leadInState.activeWord?.word.text).toBe('Start');

    // At t = 1.25 (mid-word): active
    const midState = strategy.evaluate(captions, 1.25);
    expect(midState.activeWord?.isActive).toBe(true);
    expect(midState.activeWord?.progress).toBeGreaterThan(0.4);
    expect(midState.activeWord?.progress).toBeLessThan(0.6);
  });

  it('Invariant: Word highlight de-illuminates immediately during inter-word silence (Pause Immunity)', () => {
    const strategy = new BoundedAcousticCaptionStrategy(0.05, 0.04);
    const captions: CaptionConfig[] = [
      { text: 'First', start: 1.0, end: 1.4 },
      { text: 'Second', start: 2.2, end: 2.6 }
    ];

    // During speech of first word
    const speakingState = strategy.evaluate(captions, 1.2);
    expect(speakingState.activeWord?.isActive).toBe(true);
    expect(speakingState.activeWord?.word.text).toBe('First');

    // During silent pause at t = 1.8 (400ms after First ends, 400ms before Second starts)
    const pauseState = strategy.evaluate(captions, 1.8);
    expect(pauseState.activeWord).toBeNull();
    expect(pauseState.isInSpeechPause).toBe(true);
  });

  it('Invariant: Phrase visibility boundaries respect speech window', () => {
    const strategy = new BoundedAcousticCaptionStrategy(0.05, 0.04);
    const captions: CaptionConfig[] = [
      { text: 'Hello', start: 1.0, end: 1.5 }
    ];

    // Before phrase start (-100ms): phrase should not be visible
    const beforeState = strategy.evaluate(captions, 0.85);
    expect(beforeState.shouldRender).toBe(false);

    // During phrase: visible
    const duringState = strategy.evaluate(captions, 1.2);
    expect(duringState.shouldRender).toBe(true);
    expect(duringState.phrase?.length).toBe(1);

    // Well after phrase ends (at t = 2.0s): shouldRender should turn false
    const afterState = strategy.evaluate(captions, 2.0);
    expect(afterState.shouldRender).toBe(false);
  });

  it('Invariant: Multi-word phrase grouping respects wordsPerPhrase option', () => {
    const strategy = new BoundedAcousticCaptionStrategy();
    const captions: CaptionConfig[] = [
      { text: 'The', start: 0.1, end: 0.3 },
      { text: 'quick', start: 0.35, end: 0.6 },
      { text: 'brown', start: 0.65, end: 0.9 },
      { text: 'fox', start: 0.95, end: 1.2 },
      { text: 'jumps', start: 1.25, end: 1.5 }
    ];

    const phrases = strategy.groupPhrases(captions, 3);
    expect(phrases.length).toBe(2);
    expect(phrases[0].length).toBe(3);
    expect(phrases[1].length).toBe(2);
    expect(phrases[0][0].text).toBe('The');
    expect(phrases[1][0].text).toBe('fox');
  });
});
