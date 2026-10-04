import { describe, it, expect } from 'bun:test';
import { alignScriptWithTimestamps } from '../apps/cli/src/pipelines/04-generative-story/whisper';

describe('Whisper Syllable-Weighted Script Alignment Invariants', () => {
  it('should return empty captions for empty reference script', () => {
    const res = alignScriptWithTimestamps('', [], 3.0);
    expect(res).toEqual([]);
  });

  it('Invariant: Longer/multi-syllable words receive more duration than short particles', () => {
    const script = 'và nghiên_cứu';
    // 'và' has 1 short syllable, 'nghiên_cứu' is longer and multi-syllable
    const captions = alignScriptWithTimestamps(script, [], 2.0);

    expect(captions.length).toBe(2);
    expect(captions[0].text).toBe('và');
    expect(captions[1].text).toBe('nghiên_cứu');

    const vaDuration = captions[0].end - captions[0].start;
    const nghienCuuDuration = captions[1].end - captions[1].start;

    // Multi-syllable word duration must be strictly greater than short word duration
    expect(nghienCuuDuration).toBeGreaterThan(vaDuration);
  });

  it('Invariant: Timestamps are strictly monotonic and stay within speech boundaries', () => {
    const script = 'Hôm nay trời rất đẹp và trong lành.';
    const chunks = [
      { text: 'Hôm nay trời rất đẹp và trong lành.', timestamp: [0.5, 3.5] as [number, number] }
    ];

    const captions = alignScriptWithTimestamps(script, chunks, 4.0);

    expect(captions.length).toBe(8);
    expect(captions[0].start).toBeGreaterThanOrEqual(0.5);

    for (let i = 0; i < captions.length; i++) {
      expect(captions[i].end).toBeGreaterThan(captions[i].start);
      if (i > 0) {
        expect(captions[i].start).toBeGreaterThanOrEqual(captions[i - 1].start);
      }
    }

    expect(captions[captions.length - 1].end).toBeLessThanOrEqual(3.55);
  });
});
