import { describe, it, expect } from 'bun:test';
import { TemporalCadenceResolver } from '../packages/ir/src/renderer/shared/TemporalCadenceResolver';

describe('TemporalCadenceResolver', () => {
  it('maps timeline frame to media seconds at 1.0x speed without trim', () => {
    const res = TemporalCadenceResolver.resolve({
      timelineFrame: 30,
      timelineFps: 30,
      sequenceStartFrame: 0,
      trimInSec: 0,
      speed: 1.0,
      sourceFps: 30,
    });
    expect(res.targetMediaSec).toBe(1.0);
    expect(res.sourceFrameIndex).toBe(30);
  });

  it('correctly maps 24fps media cadence on 30fps timeline', () => {
    // Timeline at 1.0 second (frame 30 at 30fps)
    const res = TemporalCadenceResolver.resolve({
      timelineFrame: 30,
      timelineFps: 30,
      sequenceStartFrame: 0,
      sourceFps: 24,
    });
    expect(res.targetMediaSec).toBe(1.0);
    expect(res.sourceFrameIndex).toBe(24);
  });

  it('incorporates trimIn and playback speed accurately', () => {
    // Start at frame 60, sequence in-point 60, trim 2.5s, speed 2.0x
    // At frame 90 (30 frames later at 30fps = 1.0s elapsed timeline time)
    // targetMediaSec = 2.5 + 1.0 * 2.0 = 4.5s
    const res = TemporalCadenceResolver.resolve({
      timelineFrame: 90,
      timelineFps: 30,
      sequenceStartFrame: 60,
      trimInSec: 2.5,
      speed: 2.0,
      sourceFps: 60,
    });
    expect(res.targetMediaSec).toBe(4.5);
    expect(res.sourceFrameIndex).toBe(270); // 4.5 * 60
  });

  it('enforces forward-step vs seek thresholding', () => {
    // 1. Initial cold start (currentMediaSec = -1) -> should seek
    const initial = TemporalCadenceResolver.resolve(
      {
        timelineFrame: 0,
        timelineFps: 30,
        sequenceStartFrame: 0,
      },
      -1
    );
    expect(initial.shouldSeek).toBe(true);

    // 2. Sequential frame step (delta = 1/30 = 0.033s <= 0.25s) -> should NOT seek
    const nextStep = TemporalCadenceResolver.resolve(
      {
        timelineFrame: 1,
        timelineFps: 30,
        sequenceStartFrame: 0,
      },
      0.0
    );
    expect(nextStep.shouldSeek).toBe(false);
    expect(nextStep.deltaSec).toBeCloseTo(0.0333, 3);

    // 3. Backward scrub (target < current) -> should seek
    const backward = TemporalCadenceResolver.resolve(
      {
        timelineFrame: 10,
        timelineFps: 30,
        sequenceStartFrame: 0,
      },
      2.0 // currently at 2.0s, jumping back to 10/30 = 0.33s
    );
    expect(backward.shouldSeek).toBe(true);

    // 4. Large forward scrub jump (> 0.5s) -> should seek
    const largeJump = TemporalCadenceResolver.resolve(
      {
        timelineFrame: 120, // 4.0s
        timelineFps: 30,
        sequenceStartFrame: 0,
      },
      0.5 // currently at 0.5s, delta = 3.5s > 0.5s
    );
    expect(largeJump.shouldSeek).toBe(true);
  });
});
