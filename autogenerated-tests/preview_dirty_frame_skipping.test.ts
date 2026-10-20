import { describe, it, expect } from 'bun:test';

describe('Preview Dirty-Frame Skipping Suite', () => {
  it('detects identical frame parameters and avoids redundant rasterization passes', () => {
    let renderPassCount = 0;
    let lastRenderedFrame: number | null = null;
    let lastRenderedLOD: number | null = null;
    let lastPopOutIntensity: number | null = null;
    let texturesDirty = false;

    function renderCurrentFrame(frame: number, lod = 1.0, popOutIntensity = 1.0, isScrubbing = false) {
      if (
        !texturesDirty &&
        !isScrubbing &&
        frame === lastRenderedFrame &&
        lod === lastRenderedLOD &&
        popOutIntensity === lastPopOutIntensity
      ) {
        return; // Skipped redundant draw!
      }

      renderPassCount++;
      lastRenderedFrame = frame;
      lastRenderedLOD = lod;
      lastPopOutIntensity = popOutIntensity;
      texturesDirty = false;
    }

    // First render at frame 0
    renderCurrentFrame(0, 1.0, 1.0);
    expect(renderPassCount).toBe(1);

    // Repeated ticks on 120Hz/144Hz displays with identical frame 0 -> skipped!
    renderCurrentFrame(0, 1.0, 1.0);
    renderCurrentFrame(0, 1.0, 1.0);
    expect(renderPassCount).toBe(1);

    // Advance to frame 1 -> executed!
    renderCurrentFrame(1, 1.0, 1.0);
    expect(renderPassCount).toBe(2);

    // Change LOD from 1.0 to 0.5 (during fast scrub/playback) -> executed!
    renderCurrentFrame(1, 0.5, 1.0);
    expect(renderPassCount).toBe(3);

    // Mark textures dirty (e.g. newly arrived decoded frame) -> executed!
    texturesDirty = true;
    renderCurrentFrame(1, 0.5, 1.0);
    expect(renderPassCount).toBe(4);
  });
});
