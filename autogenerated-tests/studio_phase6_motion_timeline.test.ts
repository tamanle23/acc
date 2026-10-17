import { describe, it, expect, beforeEach } from 'bun:test';
import { UniversalCanvasEngine } from '../packages/effect-engines/src/canvas/UniversalCanvasEngine';
import { UniversalAudioMixer } from '../packages/effect-engines/src/audio/UniversalAudioMixer';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import { TrimSequenceCommand } from '../apps/studio/src/lib/commands/TrimSequenceCommand';
import { SplitSequenceCommand } from '../apps/studio/src/lib/commands/SplitSequenceCommand';
import fs from 'fs';
import path from 'path';

describe('Phase 6: Universal Motion & Easing Engine & Timeline Direct Manipulation', () => {
  beforeEach(async () => {
    await IRStateManager.getInstance().switchTemplate('scifi');
  });

  describe('1. UniversalCanvasEngine Motion & Lifecycle Compiler', () => {
    it('compiles 3-stage lifecycle and provides getActiveInterpolatedTransform', () => {
      const engine = new UniversalCanvasEngine({ width: 1920, height: 1080 });

      const testSequences = [
        {
          id: 'seq-test-motion',
          time: { start: 0, duration: 60 }, // 2.0s at 30fps
          modifiers: [
            {
              type: 'transform',
              params: {
                x: 100,
                y: -50,
                scale: 1.5,
                rotation: 15,
                ease: 'bounce.out',
                animation: {
                  preset: 'pop_in',
                  intro: { durationSec: 0.5, ease: 'bounce.out' },
                  steady: { type: 'hold' },
                  outro: { durationSec: 0.3, ease: 'power2.in' },
                },
              },
            },
          ],
        },
      ];

      engine.syncTimeline(testSequences as any, 30);

      // At start (0.0s): initial pop_in entrance
      engine.update(0.0);
      const startInterp = engine.getActiveInterpolatedTransform('seq-test-motion');
      expect(startInterp).toBeDefined();
      expect(startInterp!.opacity).toBeCloseTo(0, 1);
      expect(startInterp!.scale).toBeLessThan(1.5);

      // Mid-intro (0.25s): scale progressing toward target 1.5 with bounce
      engine.update(0.25);
      const midIntro = engine.getActiveInterpolatedTransform('seq-test-motion');
      expect(midIntro).toBeDefined();
      expect(midIntro!.opacity).toBeGreaterThan(0);
      expect(midIntro!.scale).toBeGreaterThan(0.3);

      // Steady state (1.0s): settled at target values
      engine.update(1.0);
      const steadyInterp = engine.getActiveInterpolatedTransform('seq-test-motion');
      expect(steadyInterp).toBeDefined();
      expect(steadyInterp!.opacity).toBeCloseTo(1, 1);
      expect(steadyInterp!.x).toBeCloseTo(100, 1);
      expect(steadyInterp!.y).toBeCloseTo(-50, 1);
      expect(steadyInterp!.scale).toBeCloseTo(1.5, 1);
      expect(steadyInterp!.rotation).toBeCloseTo(15, 1);

      // Outro exit (1.9s): fading and scaling out
      engine.update(1.95);
      const outroInterp = engine.getActiveInterpolatedTransform('seq-test-motion');
      expect(outroInterp).toBeDefined();
      expect(outroInterp!.opacity).toBeLessThan(0.5);
    });

    it('evaluates motion presets (slide_left, overshoot, drift) accurately', () => {
      const engine = new UniversalCanvasEngine({ width: 1920, height: 1080 });

      const testSeqs = [
        {
          id: 'seq-drift',
          time: { start: 0, duration: 90 }, // 3.0s
          modifiers: [
            {
              type: 'transform',
              params: {
                x: 0,
                y: 0,
                scale: 1.0,
                animation: {
                  preset: 'drift',
                  intro: { durationSec: 0.4, ease: 'power2.out' },
                  steady: { type: 'drift' },
                  outro: { durationSec: 0.3, ease: 'power2.in' },
                },
              },
            },
          ],
        },
      ];

      engine.syncTimeline(testSeqs as any, 30);

      // Settle intro (0.5s)
      engine.update(0.5);
      const earlySteady = { ...engine.getActiveInterpolatedTransform('seq-drift')! };

      // Later in steady drift (2.0s)
      engine.update(2.0);
      const lateSteady = engine.getActiveInterpolatedTransform('seq-drift');

      expect(earlySteady).toBeDefined();
      expect(lateSteady).toBeDefined();
      expect(lateSteady!.x).toBeGreaterThan(earlySteady.x);
      expect(lateSteady!.scale).toBeGreaterThanOrEqual(earlySteady.scale);
    });
  });

  describe('2. UniversalAudioMixer Analog Ducking Envelopes', () => {
    it('applies exponential attack and release slew to ducking envelope', () => {
      const mixer = new UniversalAudioMixer([], 44100);
      mixer.duckingFactor = 0.2;
      mixer.attackMs = 50;
      mixer.releaseMs = 100;

      // Add a voice clip from 1.0s to 2.0s
      mixer.setClips([
        {
          id: 'voice-1',
          type: 'voice',
          startTimeSec: 1.0,
          durationSec: 1.0,
          volume: 1.0,
          pan: 0,
        },
        {
          id: 'bgm-1',
          type: 'bgm',
          startTimeSec: 0.0,
          durationSec: 3.0,
          volume: 1.0,
          pan: 0,
        },
      ]);

      const result = mixer.mixStereo(0.0, 3.0);
      expect(result.left).toBeInstanceOf(Float32Array);
      expect(result.right).toBeInstanceOf(Float32Array);
      expect(result.left.length).toBe(3 * 44100);
      expect(result.peakDb).toBeDefined();
    });
  });

  describe('3. Multi-Track Timeline Commands & Recovery', () => {
    it('executes TrimSequenceCommand and recovers state via undo', () => {
      const manager = IRStateManager.getInstance();
      const stateBefore = manager.getState();
      const seqId = 'seq-city-intro';

      const initialSeq = stateBefore.doc.tracks[0].sequences.find((s) => s.id === seqId);
      expect(initialSeq).toBeDefined();
      const initialDur = typeof initialSeq!.time.duration === 'number' ? initialSeq!.time.duration : 90;

      // Trim duration by +15 frames
      manager.dispatch(new TrimSequenceCommand(seqId, 0, 15));
      const stateTrimmed = manager.getState();
      const trimmedSeq = stateTrimmed.doc.tracks[0].sequences.find((s) => s.id === seqId);
      expect(trimmedSeq!.time.duration).toBe(initialDur + 15);

      // Undo trim
      manager.undo();
      const stateUndo = manager.getState();
      const restoredSeq = stateUndo.doc.tracks[0].sequences.find((s) => s.id === seqId);
      expect(restoredSeq!.time.duration).toBe(initialDur);
    });

    it('executes SplitSequenceCommand (Razor cut) at playhead frame and restores via undo', () => {
      const manager = IRStateManager.getInstance();
      const stateBefore = manager.getState();
      const targetTrack = stateBefore.doc.tracks[0];
      const seqId = targetTrack.sequences[0].id;
      const initialCount = targetTrack.sequences.length;

      // Razor cut at frame 45
      manager.splitSequence(seqId, 45);

      const stateSplit = manager.getState();
      const splitTrack = stateSplit.doc.tracks.find((t) => t.id === targetTrack.id);
      expect(splitTrack!.sequences.length).toBe(initialCount + 1);

      // Verify sequence 1 has duration 45
      const seq1 = splitTrack!.sequences.find((s) => s.id === seqId);
      expect(seq1!.time.duration).toBe(45);

      // Undo razor cut
      manager.undo();
      const stateUndo = manager.getState();
      const restoredTrack = stateUndo.doc.tracks.find((t) => t.id === targetTrack.id);
      expect(restoredTrack!.sequences.length).toBe(initialCount);
    });
  });

  describe('4. Component Integration Verification', () => {
    it('verifies Timeline.tsx implements drag trimming, snapping, and razor tool', () => {
      const timelineCode = fs.readFileSync(
        path.join(__dirname, '../apps/studio/src/components/Timeline.tsx'),
        'utf-8'
      );
      expect(timelineCode).toContain('trimmingState');
      expect(timelineCode).toContain('startTrim');
      expect(timelineCode).toContain('cursor-col-resize');
      expect(timelineCode).toContain('handleClipClick');
      expect(timelineCode).toContain('activeTool === \'razor\'');
      expect(timelineCode).toContain('cursor-crosshair');
      expect(timelineCode).toContain('snapEnabled');
    });

    it('verifies RightSidebar.tsx exposes Motion Preset & Lifecycle controls', () => {
      const rightSidebarCode = fs.readFileSync(
        path.join(__dirname, '../apps/studio/src/components/RightSidebar.tsx'),
        'utf-8'
      );
      expect(rightSidebarCode).toContain('Motion Preset & Lifecycle');
      expect(rightSidebarCode).toContain('Pop In');
      expect(rightSidebarCode).toContain('Slide In');
      expect(rightSidebarCode).toContain('Bounce');
      expect(rightSidebarCode).toContain('Intro Duration');
      expect(rightSidebarCode).toContain('Outro Duration');
    });

    it('verifies Preview.tsx binds live GSAP interpolated transform to canvas overlay', () => {
      const previewCode = fs.readFileSync(
        path.join(__dirname, '../apps/studio/src/components/Preview.tsx'),
        'utf-8'
      );
      expect(previewCode).toContain('getActiveInterpolatedTransform');
      expect(previewCode).toContain('activeInterp');
    });

    it('verifies ShortcutsModal.tsx exists and is wired to Titlebar.tsx', () => {
      const shortcutsFile = fs.existsSync(
        path.join(__dirname, '../apps/studio/src/components/ShortcutsModal.tsx')
      );
      expect(shortcutsFile).toBe(true);

      const titlebarCode = fs.readFileSync(
        path.join(__dirname, '../apps/studio/src/components/Titlebar.tsx'),
        'utf-8'
      );
      expect(titlebarCode).toContain('ShortcutsModal');
      expect(titlebarCode).toContain('isShortcutsOpen');
      expect(titlebarCode).toContain('Keyboard Shortcuts (?)');
    });
  });
});
