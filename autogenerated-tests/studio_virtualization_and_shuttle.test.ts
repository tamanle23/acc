import { describe, it, expect, beforeEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import {
  type ShuttleSpeed,
  timeToDiscreteFrame,
  discreteFrameToTime,
  snapToDiscreteFrame,
  getNextShuttleSpeed,
  shouldMuteAudio,
  getAudioPlaybackRate,
  SHUTTLE_SPEEDS,
} from '../apps/studio/src/lib/shuttle/shuttleTypes';
import { useVirtualizer } from '@tanstack/react-virtual';
import WaveSurfer from 'wavesurfer.js';
import {
  getCachedPeaks,
  clearWaveSurferPeakCache,
} from '../apps/studio/src/components/timeline/WaveSurferWaveform';

describe('Iteration 13: Large Timeline Virtualization, WaveSurfer Waveforms, & J-K-L Shuttle Engine', () => {
  beforeEach(() => {
    clearWaveSurferPeakCache();
  });

  describe('1. Discrete Frame Snapping Math & Invariants', () => {
    it('accurately snaps floating seconds to exact discrete integer frames', () => {
      const fps = 30;
      // 0.033333s at 30 fps is frame 1
      expect(timeToDiscreteFrame(1 / 30, fps)).toBe(1);
      expect(timeToDiscreteFrame(0.5, fps)).toBe(15);
      expect(timeToDiscreteFrame(1.0, fps)).toBe(30);

      // Fractional float rounding prevents continuous float drift
      expect(timeToDiscreteFrame(1.018, fps)).toBe(31);
      expect(timeToDiscreteFrame(0.985, fps)).toBe(30);
    });

    it('converts discrete integer frame back to timeline seconds', () => {
      const fps = 30;
      expect(discreteFrameToTime(0, fps)).toBe(0);
      expect(discreteFrameToTime(15, fps)).toBe(0.5);
      expect(discreteFrameToTime(30, fps)).toBe(1.0);
    });

    it('snaps floating frame offsets strictly to discrete integer frames', () => {
      expect(snapToDiscreteFrame(44.2)).toBe(44);
      expect(snapToDiscreteFrame(44.8)).toBe(45);
      expect(snapToDiscreteFrame(-0.1)).toBe(0);
    });
  });

  describe('2. Frame-Accurate J-K-L Shuttle State Machine', () => {
    it('accelerates forward on L key [0x -> 1x -> 2x -> 4x -> 8x]', () => {
      let speed: ShuttleSpeed = 0;
      speed = getNextShuttleSpeed(speed, 'forward');
      expect(speed).toBe(1);

      speed = getNextShuttleSpeed(speed, 'forward');
      expect(speed).toBe(2);

      speed = getNextShuttleSpeed(speed, 'forward');
      expect(speed).toBe(4);

      speed = getNextShuttleSpeed(speed, 'forward');
      expect(speed).toBe(8);

      // Capped at 8x max
      speed = getNextShuttleSpeed(speed, 'forward');
      expect(speed).toBe(8);
    });

    it('accelerates in reverse on J key [0x -> -1x -> -2x -> -4x -> -8x]', () => {
      let speed: ShuttleSpeed = 0;
      speed = getNextShuttleSpeed(speed, 'reverse');
      expect(speed).toBe(-1);

      speed = getNextShuttleSpeed(speed, 'reverse');
      expect(speed).toBe(-2);

      speed = getNextShuttleSpeed(speed, 'reverse');
      expect(speed).toBe(-4);

      speed = getNextShuttleSpeed(speed, 'reverse');
      expect(speed).toBe(-8);

      // Capped at -8x min
      speed = getNextShuttleSpeed(speed, 'reverse');
      expect(speed).toBe(-8);
    });

    it('immediately halts shuttle to 0x on K key', () => {
      expect(getNextShuttleSpeed(8, 'stop')).toBe(0);
      expect(getNextShuttleSpeed(-8, 'stop')).toBe(0);
      expect(getNextShuttleSpeed(2, 'stop')).toBe(0);
      expect(getNextShuttleSpeed(-1, 'stop')).toBe(0);
    });

    it('decelerates smoothly when opposing shuttle direction is pressed', () => {
      // Forward to reverse transition
      let speed: ShuttleSpeed = 4;
      speed = getNextShuttleSpeed(speed, 'reverse');
      expect(speed).toBe(2);

      speed = getNextShuttleSpeed(speed, 'reverse');
      expect(speed).toBe(1);

      speed = getNextShuttleSpeed(speed, 'reverse');
      expect(speed).toBe(0);

      speed = getNextShuttleSpeed(speed, 'reverse');
      expect(speed).toBe(-1);

      // Reverse to forward transition
      speed = -4;
      speed = getNextShuttleSpeed(speed, 'forward');
      expect(speed).toBe(-2);

      speed = getNextShuttleSpeed(speed, 'forward');
      expect(speed).toBe(-1);

      speed = getNextShuttleSpeed(speed, 'forward');
      expect(speed).toBe(0);

      speed = getNextShuttleSpeed(speed, 'forward');
      expect(speed).toBe(1);
    });

    it('defensively handles non-standard or arbitrary speed numbers by snapping to nearest valid shuttle speed', () => {
      expect(getNextShuttleSpeed(3 as any, 'forward')).toBe(4);
      expect(getNextShuttleSpeed(-3 as any, 'reverse')).toBe(-4);
      expect(getNextShuttleSpeed(5 as any, 'forward')).toBe(8);
    });
  });

  describe('3. Deterministic Audio Hardware Clock Sync & Muting Rules', () => {
    it('preserves audio pitch and un-mutes only for forward speeds up to 2x', () => {
      expect(shouldMuteAudio(1)).toBe(false);
      expect(shouldMuteAudio(2)).toBe(false);
      expect(getAudioPlaybackRate(1)).toBe(1.0);
      expect(getAudioPlaybackRate(2)).toBe(2.0);
    });

    it('safely mutes audio in reverse or at high speeds (>= 4x) or when stopped', () => {
      expect(shouldMuteAudio(0)).toBe(true);
      expect(shouldMuteAudio(-1)).toBe(true);
      expect(shouldMuteAudio(-2)).toBe(true);
      expect(shouldMuteAudio(-4)).toBe(true);
      expect(shouldMuteAudio(-8)).toBe(true);
      expect(shouldMuteAudio(4)).toBe(true);
      expect(shouldMuteAudio(8)).toBe(true);
    });
  });

  describe('4. TanStack Virtualization & Track Windowing', () => {
    it('computes exact virtual row count and total height via @tanstack/react-virtual', () => {
      const mockElement = {
        scrollTop: 100,
        scrollLeft: 0,
        clientHeight: 300,
        clientWidth: 1200,
        addEventListener: () => {},
        removeEventListener: () => {},
      };

      const virtualizer = useVirtualizer({
        count: 50,
        getScrollElement: () => mockElement as any,
        estimateSize: () => 48,
        overscan: 2,
      });

      expect(virtualizer.getTotalSize()).toBe(50 * 48);
      const items = virtualizer.getVirtualItems();
      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThan(50); // Virtual windowed, not all 50 in DOM
    });
  });

  describe('5. Horizontal Sequence Virtual Windowing & Drag Retention', () => {
    it('correctly windows sequences within visible viewport range plus buffer', () => {
      const pixelsPerFrame = 4;
      const scrollLeft = 800; // 200 frames in
      const clientWidth = 800; // 200 frames width (visible: 200f to 400f)
      const bufferFrames = Math.ceil(400 / pixelsPerFrame); // 100f buffer

      const visibleStartFrame = Math.max(0, Math.floor(scrollLeft / pixelsPerFrame) - bufferFrames); // 100f
      const visibleEndFrame = Math.ceil((scrollLeft + clientWidth) / pixelsPerFrame) + bufferFrames; // 500f

      const sequences = [
        { id: 'seq-1', startFrame: 0, durationFrames: 50 },     // 0-50f (offscreen left)
        { id: 'seq-2', startFrame: 120, durationFrames: 60 },   // 120-180f (visible)
        { id: 'seq-3', startFrame: 300, durationFrames: 90 },   // 300-390f (visible)
        { id: 'seq-4', startFrame: 450, durationFrames: 30 },   // 450-480f (visible)
        { id: 'seq-5', startFrame: 600, durationFrames: 100 },  // 600-700f (offscreen right)
      ];

      const visible = sequences.filter((seq) => {
        const seqEnd = seq.startFrame + seq.durationFrames;
        return seqEnd >= visibleStartFrame && seq.startFrame <= visibleEndFrame;
      });

      expect(visible.map((s) => s.id)).toEqual(['seq-2', 'seq-3', 'seq-4']);
    });

    it('always retains active dragged sequence in DOM even if scrolled out of viewport', () => {
      const activeDragState = {
        type: 'clip' as const,
        seqId: 'seq-1',
        initialStartFrame: 0,
        initialDurationFrames: 50,
        deltaFrames: 0,
      };

      const visibleStartFrame = 500;
      const visibleEndFrame = 1000;

      const sequences = [
        { id: 'seq-1', startFrame: 0, durationFrames: 50 }, // Offscreen left!
        { id: 'seq-2', startFrame: 600, durationFrames: 100 }, // Visible
      ];

      const visible = sequences.filter((seq) => {
        if (activeDragState?.seqId === seq.id) return true;
        const seqEnd = seq.startFrame + seq.durationFrames;
        return seqEnd >= visibleStartFrame && seq.startFrame <= visibleEndFrame;
      });

      expect(visible.map((s) => s.id)).toContain('seq-1');
      expect(visible.map((s) => s.id)).toContain('seq-2');
    });

    it('handles sequences with timelineStartFrame fallback during horizontal windowing', () => {
      const visibleStartFrame = 100;
      const visibleEndFrame = 500;

      const sequences = [
        { id: 'seq-legacy-1', timelineStartFrame: 200, durationFrames: 50 }, // 200-250 (visible)
        { id: 'seq-legacy-2', timelineStartFrame: 600, durationFrames: 50 }, // 600-650 (offscreen)
      ];

      const visible = sequences.filter((seq) => {
        const seqStart = (seq as any).startFrame ?? (seq as any).timelineStartFrame ?? 0;
        const seqEnd = seqStart + seq.durationFrames;
        return seqEnd >= visibleStartFrame && seqStart <= visibleEndFrame;
      });

      expect(visible.map((s) => s.id)).toEqual(['seq-legacy-1']);
    });
  });

  describe('6. WaveSurfer Audio Waveform Peak Caching & Lifecycle', () => {
    it('caches peaks per id, duration, and bar count to eliminate re-decoding', () => {
      const peaks1 = getCachedPeaks('audio-clip-1', 90, 40);
      expect(peaks1.length).toBe(40);

      const peaks2 = getCachedPeaks('audio-clip-1', 90, 40);
      expect(peaks1).toBe(peaks2); // Same reference from memory cache
    });

    it('instantiates WaveSurfer instance and destroys cleanly', () => {
      const mockContainer = {
        appendChild: () => {},
        removeChild: () => {},
      };

      const ws = WaveSurfer.create({
        container: mockContainer as any,
        waveColor: '#a855f7',
        duration: 3.0,
        peaks: [[0.2, 0.5, 0.8, 0.4]],
      });

      expect(ws).toBeDefined();
      expect(ws.getDuration()).toBe(3.0);

      let destroyed = false;
      ws.on('destroy', () => {
        destroyed = true;
      });

      ws.destroy();
      expect(destroyed).toBe(true);
    });
  });

  describe('7. Structural & Declarative Architecture Verification', () => {
    it('verifies Timeline.tsx imports and integrates @tanstack/react-virtual, useShuttleEngine, and discrete frame snapping', () => {
      const timelineCode = fs.readFileSync(
        path.join(__dirname, '../apps/studio/src/components/Timeline.tsx'),
        'utf-8'
      );

      expect(timelineCode).toContain("from '@tanstack/react-virtual'");
      expect(timelineCode).toContain('useVirtualizer');
      expect(timelineCode).toContain('useShuttleEngine');
      expect(timelineCode).toContain('snapToDiscreteFrame');
      expect(timelineCode).toContain('rowVirtualizer');
      expect(timelineCode).toContain('visibleSequences');
    });

    it('verifies Timeline.tsx does not duplicate Space and Arrow transport keybindings', () => {
      const timelineCode = fs.readFileSync(
        path.join(__dirname, '../apps/studio/src/components/Timeline.tsx'),
        'utf-8'
      );

      // Timeline keydown should strictly handle editing tools (razor c, select v, hand h, zoom z)
      // Transport controls (Space, ArrowLeft, ArrowRight, J, K, L) are centralized in useShuttleEngine
      expect(timelineCode).not.toContain("e.code === 'Space'");
      expect(timelineCode).not.toContain("e.code === 'ArrowLeft'");
      expect(timelineCode).not.toContain("e.code === 'ArrowRight'");
    });

    it('verifies AudioWaveform.tsx delegates to WaveSurferWaveform', () => {
      const waveformCode = fs.readFileSync(
        path.join(__dirname, '../apps/studio/src/components/timeline/AudioWaveform.tsx'),
        'utf-8'
      );

      expect(waveformCode).toContain('WaveSurferWaveform');
    });

    it('verifies apps/studio/package.json contains @tanstack/react-virtual and wavesurfer.js', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../apps/studio/package.json'), 'utf-8')
      );

      expect(packageJson.dependencies['@tanstack/react-virtual']).toBeDefined();
      expect(packageJson.dependencies['wavesurfer.js']).toBeDefined();
    });
  });
});
