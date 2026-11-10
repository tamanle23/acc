import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { DeterministicTimelineClock } from '../packages/core-isomorphic/src';
import { PlayheadController } from '../apps/studio/src/lib/playhead/PlayheadController';
import { createShuttleEngine } from '../apps/studio/src/lib/shuttle/useShuttleEngine';

describe('Studio Playhead Controller, Shuttle Engine & Deterministic Clock Suite', () => {
  beforeEach(() => {
    PlayheadController.getInstance().setConfig(30, 300);
    PlayheadController.getInstance().setIsPlaying(false);
    PlayheadController.getInstance().seek(0, true);
  });

  afterEach(() => {
    PlayheadController.getInstance().setIsPlaying(false);
    PlayheadController.getInstance().seek(0, true);
  });

  describe('DeterministicTimelineClock Sub-Frame Precision & Mode Continuity', () => {
    it('should maintain floating-point fractional frames on tick without intermediate integer rounding', () => {
      const clock = new DeterministicTimelineClock({
        fps: 30,
        totalFrames: 300,
        mode: 'monotonic_worker',
      });

      clock.play(0, 1.0);

      // Tick by 0.0166667s (approx 1 frame at 60Hz display = 0.5 timeline frames at 30fps)
      const targetFrame = clock.tick(0.01666667);

      expect(targetFrame).toBeGreaterThan(0.4);
      expect(targetFrame).toBeLessThan(0.6);
      expect(clock.getFractionalFrame()).toBeCloseTo(0.5, 1);
      // Discrete frame should round safely to nearest integer
      expect(clock.getFrame()).toBe(Math.round(targetFrame));
    });

    it('should maintain C0 continuity and re-anchor without jumping backward when switching sync modes', () => {
      const clock = new DeterministicTimelineClock({
        fps: 30,
        totalFrames: 300,
        mode: 'monotonic_worker',
      });

      clock.play(50, 1.0);

      // Advance by 1.0 second (30 frames) in monotonic mode
      clock.tick(1.0);
      const frameBeforeSwitch = clock.getFrame();
      expect(frameBeforeSwitch).toBe(80);

      // Switch mode to audio_master (e.g. AudioContext resumed)
      clock.setSyncMode('audio_master');

      // The new anchor should start from 80, NOT jump back to 50
      expect(clock.getFrame()).toBe(80);

      // Tick in audio_master mode with an audio hardware timestamp
      // First tick in audio_master re-anchors audioStartSec
      clock.tick(10.0);
      expect(clock.getFrame()).toBe(80);

      // Next tick 0.1s later (3 frames)
      clock.tick(10.1);
      expect(clock.getFrame()).toBe(83);
    });

    it('should re-anchor seamlessly when falling back from audio_master to monotonic_worker', () => {
      const clock = new DeterministicTimelineClock({
        fps: 30,
        totalFrames: 300,
        mode: 'audio_master',
      });

      clock.play(20, 1.0);
      clock.lockMasterAudio(5.0);

      // Advance audio by 0.5s (15 frames)
      clock.tick(5.5);
      expect(clock.getFrame()).toBe(35);

      // Fallback to monotonic_worker (e.g. AudioContext suspended or audio ended)
      clock.setSyncMode('monotonic_worker');
      expect(clock.getFrame()).toBe(35);

      // Advance monotonic delta by 0.1s (3 frames)
      clock.tick(0.1);
      expect(clock.getFrame()).toBe(38);
    });
  });

  describe('PlayheadController Real-Time SSOT & High-Frequency Subscribers', () => {
    it('should expose getFractionalFrame and notify high-frequency subscribers with sub-frame precision', () => {
      const controller = PlayheadController.getInstance();
      controller.setConfig(30, 300);

      let receivedFractional: number | undefined;
      let receivedDiscrete = -1;

      const unsub = controller.subscribeHighFrequency((frame, _playing, frac) => {
        receivedDiscrete = frame;
        receivedFractional = frac;
      });

      // Seek with sub-frame position
      controller.seek(15, false, 15.42);

      expect(controller.getFrame()).toBe(15);
      expect(controller.getFractionalFrame()).toBe(15.42);
      expect(receivedDiscrete).toBe(15);
      expect(receivedFractional).toBe(15.42);

      unsub();
    });

    it('should trigger immediate low-frequency sync when playhead is paused', () => {
      const controller = PlayheadController.getInstance();
      let lowFreqCalls = 0;

      const unsub = controller.subscribeLowFrequency(() => {
        lowFreqCalls++;
      });

      controller.setIsPlaying(true);
      const callsWhilePlaying = lowFreqCalls;

      controller.setIsPlaying(false);
      // Pausing must immediately notify low-frequency UI listeners so badges and inspectors sync
      expect(lowFreqCalls).toBeGreaterThan(callsWhilePlaying);

      unsub();
    });
  });

  describe('Shuttle Engine & Interactive Scrub Halting', () => {
    it('should preserve exact playhead position on pause without snapping backwards to stale signals', () => {
      let scrubbedFrame = 0;
      const controller = PlayheadController.getInstance();
      controller.seek(100, true);

      const shuttle = createShuttleEngine({
        currentFrame: () => scrubbedFrame,
        totalFrames: 300,
        fps: 30,
        onScrub: (f) => {
          scrubbedFrame = f;
        },
      });

      // Simulate playhead having advanced to frame 145 via RAF
      controller.seek(145, false, 145.3);
      expect(controller.getFrame()).toBe(145);

      // When shuttle pause is triggered, it MUST park on controller's 145, NOT the old signal (0)
      shuttle.shuttleStop();

      expect(controller.getFrame()).toBe(145);
      expect(scrubbedFrame).toBe(145);
      expect(shuttle.isPlaying).toBe(false);
    });

    it('should step single discrete frames accurately relative to PlayheadController', () => {
      let scrubbedFrame = 50;
      const controller = PlayheadController.getInstance();
      controller.seek(50, true);

      const shuttle = createShuttleEngine({
        currentFrame: () => scrubbedFrame,
        totalFrames: 300,
        fps: 30,
        onScrub: (f) => {
          scrubbedFrame = f;
        },
      });

      shuttle.stepFrame(1);
      expect(controller.getFrame()).toBe(51);
      expect(scrubbedFrame).toBe(51);

      shuttle.stepFrame(-1);
      expect(controller.getFrame()).toBe(50);
      expect(scrubbedFrame).toBe(50);
    });
  });
});
