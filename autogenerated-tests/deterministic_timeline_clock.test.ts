import { describe, it, expect } from 'bun:test';
import { DeterministicTimelineClock } from '@acc/core-isomorphic';

describe('DeterministicTimelineClock Test Suite', () => {
  it('advances frames deterministically under audio master clock without drift', () => {
    const clock = new DeterministicTimelineClock({ fps: 30, totalFrames: 300 });
    clock.play(0, 1.0);
    clock.lockMasterAudio(0.0);

    // Simulate audio clock timestamps advancing
    expect(clock.tick(0.0)).toBe(0);
    expect(clock.tick(0.1)).toBe(3); // 0.1s * 30fps = 3
    expect(clock.tick(0.5)).toBe(15);
    expect(clock.tick(1.0)).toBe(30);
    expect(clock.tick(3.33333333)).toBe(100);
  });

  it('produces identical frame sequences regardless of simulated monitor refresh rate (60Hz vs 120Hz vs 144Hz)', () => {
    const runSimulation = (refreshHz: number) => {
      const clock = new DeterministicTimelineClock({ fps: 24, totalFrames: 240 });
      clock.play(0, 1.0);
      clock.lockMasterAudio(0.0);

      const frames: number[] = [];
      const deltaSec = 1.0 / refreshHz;
      let audioTime = 0.0;

      // Simulate 2 seconds of playback
      const steps = refreshHz * 2;
      for (let i = 0; i < steps; i++) {
        audioTime += deltaSec;
        frames.push(clock.tick(audioTime));
      }

      return {
        endFrame: frames[frames.length - 1],
        distinctCount: new Set(frames).size,
      };
    };

    const sim60 = runSimulation(60);
    const sim120 = runSimulation(120);
    const sim144 = runSimulation(144);

    // At 2.0s, a 24fps video must end at frame 48 exactly on all monitors
    expect(sim60.endFrame).toBe(48);
    expect(sim120.endFrame).toBe(48);
    expect(sim144.endFrame).toBe(48);

    // Number of distinct video frames evaluated must be identical across refresh rates
    expect(sim60.distinctCount).toBe(49);
    expect(sim120.distinctCount).toBe(49);
    expect(sim144.distinctCount).toBe(49);
  });

  it('supports reverse J-K-L shuttle and discrete monotonic stepping', () => {
    const clock = new DeterministicTimelineClock({ fps: 30, totalFrames: 100 });
    clock.seek(50);
    expect(clock.getFrame()).toBe(50);

    // Reverse shuttle at -2x speed
    clock.play(50, -2.0);
    clock.setSyncMode('monotonic_worker');

    const dt = 1.0 / 60.0; // 60Hz tick
    for (let i = 0; i < 30; i++) {
      clock.tick(dt);
    }

    // 30 * (1/60) = 0.5s * 30fps * -2 speed = -30 frames -> 50 - 30 = 20
    expect(clock.getFrame()).toBe(20);
  });

  it('clamps correctly at start and end boundaries', () => {
    const clock = new DeterministicTimelineClock({ fps: 30, totalFrames: 50 });
    clock.play(40, 2.0);
    clock.lockMasterAudio(0.0);

    // Jump far into future
    expect(clock.tick(10.0)).toBe(49);
    expect(clock.getState().isPlaying).toBe(false);

    // Reverse past frame 0
    clock.play(10, -2.0);
    clock.lockMasterAudio(0.0);
    expect(clock.tick(5.0)).toBe(0);
    expect(clock.getState().isPlaying).toBe(false);
  });

  it('re-anchors audio master clock without jump when seeking during playback', () => {
    const clock = new DeterministicTimelineClock({ fps: 30, totalFrames: 1000 });
    clock.play(0, 1.0);
    clock.lockMasterAudio(100.0); // Hardware audio starts at 100s

    // Tick forward 5 seconds (audio time = 105s, 150 frames)
    expect(clock.tick(105.0)).toBe(150);

    // Case 1: User seeks to frame 10 with explicit audio timestamp 105.0s
    clock.seek(10, 105.0);
    expect(clock.getFrame()).toBe(10);

    // Next tick is at audio time 105.1s (0.1s after seek)
    // Must advance 3 frames from 10 -> 13, NOT jump to 163!
    expect(clock.tick(105.1)).toBe(13);
    expect(clock.tick(106.0)).toBe(40);

    // Case 2: User seeks to frame 20 without timestamp
    clock.seek(20);
    // First tick at 106.0 re-anchors to 106.0s (frame 20)
    expect(clock.tick(106.0)).toBe(20);
    // Next tick at 106.1s advances 3 frames -> 23
    expect(clock.tick(106.1)).toBe(23);
  });
});
