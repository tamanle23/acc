import { describe, it, expect, beforeEach } from 'bun:test';
import { createRoot } from 'solid-js';
import { createShuttleEngine } from '../apps/studio/src/lib/shuttle/useShuttleEngine';
import { PlayheadController } from '../apps/studio/src/lib/playhead/PlayheadController';
import { DeterministicTimelineClock } from '../packages/core-isomorphic/src/math/clock/DeterministicTimelineClock';

describe('Studio Single-Click Replay & Boundary Wrap Suite', () => {
  beforeEach(() => {
    const controller = PlayheadController.getInstance();
    controller.setConfig(30, 300);
    controller.seek(0, true);
    controller.setIsPlaying(false);
  });

  it('TC-82-01: should immediately rewind to frame 0 and set speed to 1 in a single togglePlay call when parked at maxBound', () => {
    createRoot((dispose) => {
      const controller = PlayheadController.getInstance();
      const totalFrames = 300;
      const maxBound = totalFrames - 1; // 299

      let scrubCalledCount = 0;
      const shuttle = createShuttleEngine({
        fps: 30,
        totalFrames,
        currentFrame: maxBound,
        onScrub: () => {
          scrubCalledCount++;
        },
        enableKeybindings: false,
      });

      // Park at the end of the timeline
      controller.seek(maxBound, true);
      shuttle.setSpeed(0);

      expect(controller.getFrame()).toBe(maxBound);
      expect(shuttle.speed).toBe(0);
      expect(shuttle.isPlaying).toBe(false);

      // Reset scrub counter before clicking play
      scrubCalledCount = 0;

      // Click 1: togglePlay to replay!
      shuttle.togglePlay();

      // IN EXACTLY 1 CLICK:
      // 1. Playhead must be rewound to 0
      expect(controller.getFrame()).toBe(0);
      // 2. Shuttle speed must be 1
      expect(shuttle.speed).toBe(1);
      // 3. isPlaying must be true
      expect(shuttle.isPlaying).toBe(true);
      expect(controller.getIsPlaying()).toBe(true);

      // 4. Boundary rewind must NOT dispatch options.onScrub (no scrub audio feedback or re-entrant pause)
      expect(scrubCalledCount).toBe(0);

      dispose();
    });
  });

  it('TC-82-02: should wrap cleanly to maxBound when initiating reverse shuttle from frame 0', () => {
    createRoot((dispose) => {
      const controller = PlayheadController.getInstance();
      const totalFrames = 300;
      const maxBound = totalFrames - 1; // 299

      const shuttle = createShuttleEngine({
        fps: 30,
        totalFrames,
        currentFrame: 0,
        onScrub: () => {},
        enableKeybindings: false,
      });

      controller.seek(0, true);
      shuttle.setSpeed(0);

      // Reverse shuttle at frame 0
      shuttle.shuttleReverse(); // -1x

      expect(shuttle.speed).toBe(-1);
      expect(controller.getFrame()).toBe(maxBound);
      expect(shuttle.isPlaying).toBe(true);

      dispose();
    });
  });

  it('TC-82-03: should synchronize parked frame on pause without circular recursion or re-entrant halts', () => {
    createRoot((dispose) => {
      const controller = PlayheadController.getInstance();
      const totalFrames = 300;
      const endFrame = totalFrames - 1;

      let scrubCalledCount = 0;
      let lastScrubbedFrame = -1;
      const shuttle = createShuttleEngine({
        fps: 30,
        totalFrames,
        currentFrame: 0,
        onScrub: (f) => {
          scrubCalledCount++;
          lastScrubbedFrame = f;
        },
        enableKeybindings: false,
      });

      // Simulate playback hitting endFrame
      controller.seek(endFrame, true);
      scrubCalledCount = 0;

      // When setSpeed(0) is called at timeline boundary, it syncs the parked frame exactly once
      shuttle.setSpeed(0);

      expect(shuttle.speed).toBe(0);
      expect(shuttle.isPlaying).toBe(false);
      expect(scrubCalledCount).toBe(1);
      expect(lastScrubbedFrame).toBe(endFrame);

      dispose();
    });
  });

  it('TC-82-04: DeterministicTimelineClock initialized with frame 0 advances smoothly and does not immediately abort', () => {
    const totalFrames = 300;
    const clock = new DeterministicTimelineClock({
      fps: 30,
      totalFrames,
      mode: 'monotonic_worker',
    });

    clock.play(0, 1);
    expect(clock.getFrame()).toBe(0);
    expect(clock.getState().isPlaying).toBe(true);

    // First tick (16ms = ~0.5 frames at 30fps)
    const tickFrame = clock.tick(1 / 60);
    expect(tickFrame).toBeGreaterThan(0);
    expect(tickFrame).toBeLessThan(1);
    expect(clock.getState().isPlaying).toBe(true);
  });

  it('TC-82-05: Step frame continues to operate accurately with discrete frames and scrub callbacks', () => {
    createRoot((dispose) => {
      const controller = PlayheadController.getInstance();
      let lastScrubbed = -1;

      const shuttle = createShuttleEngine({
        fps: 30,
        totalFrames: 300,
        currentFrame: 10,
        onScrub: (f) => {
          lastScrubbed = f;
        },
        enableKeybindings: false,
      });

      controller.seek(10, true);
      shuttle.stepFrame(1);

      expect(controller.getFrame()).toBe(11);
      expect(lastScrubbed).toBe(11);

      shuttle.stepFrame(-5);
      expect(controller.getFrame()).toBe(6);
      expect(lastScrubbed).toBe(6);

      dispose();
    });
  });
});
