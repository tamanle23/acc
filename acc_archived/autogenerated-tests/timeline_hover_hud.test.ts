import { describe, it, expect } from 'bun:test';
import { RationalTime } from '@acc/core-isomorphic';

describe('Timeline Sequence Insight & Hover HUD Formatting', () => {
  it('should format exact SMPTE In/Out/Duration timecodes at 30 fps', () => {
    const fps = 30;
    const startFrame = 45;
    const durationFrames = 90;
    const endFrame = startFrame + durationFrames;

    const startSMPTE = RationalTime.fromFrame(startFrame, fps).toSMPTE(fps);
    const endSMPTE = RationalTime.fromFrame(endFrame, fps).toSMPTE(fps);
    const durSMPTE = RationalTime.fromFrame(durationFrames, fps).toSMPTE(fps);

    expect(startSMPTE).toBe('00:00:01:15'); // 45 frames = 1s 15f
    expect(endSMPTE).toBe('00:00:04:15'); // 135 frames = 4s 15f
    expect(durSMPTE).toBe('00:00:03:00'); // 90 frames = 3s 0f
  });

  it('should extract active modifier chips and dialogue cues accurately', () => {
    const seq = {
      id: 'clip_dialogue_01',
      name: 'Pilot Briefing',
      modifiers: [
        { type: 'transform', params: { x: 10, y: 20 } },
        { type: 'color/grading', params: { preset: 'teal_orange' } },
        { type: 'transition/crossfade', params: { durationFrames: 15 } },
        { type: 'audio/volume', params: { gainDb: -3 } },
      ],
      cues: [
        {
          startFrame: 0,
          endFrame: 60,
          text: 'All systems nominal, preparing for warp jump.',
        },
      ],
    };

    const modifierShortNames = seq.modifiers.map((m) => m.type.split('/').pop());
    expect(modifierShortNames).toEqual(['transform', 'grading', 'crossfade', 'volume']);
    expect(seq.cues[0].text).toContain('All systems nominal');
  });
});
