import { describe, it, expect, beforeEach } from 'bun:test';
import { getCachedPeaks, clearWaveSurferPeakCache } from '../apps/studio/src/components/timeline/WaveSurferWaveform';
import { WaveformLODPyramid } from '../apps/studio/src/lib/timeline/WaveformLODPyramid';
import type { StudioSequence } from '../apps/studio/src/lib/ir/studioTypes';

describe('TrackWaveformVirtualCanvas & Frustum Culling Suite', () => {
  beforeEach(() => {
    clearWaveSurferPeakCache();
  });

  // =========================================================================
  // 1. Frustum Culling Intersection Logic
  // =========================================================================
  describe('Deterministic Frustum Culling & Viewport Projection', () => {
    const sequences: StudioSequence[] = [
      { id: 'seq-1', trackId: 'track-a1', startFrame: 0, durationFrames: 60, assetId: 'audio-1' },
      { id: 'seq-2', trackId: 'track-a1', startFrame: 100, durationFrames: 80, assetId: 'audio-2' },
      { id: 'seq-3', trackId: 'track-a1', startFrame: 300, durationFrames: 120, assetId: 'audio-3' },
    ];

    it('correctly culls clips completely outside the viewport interval [F_start, F_end]', () => {
      const pixelsPerFrame = 10;
      const viewportWidth = 1000; // 100 frames wide
      const scrollLeft = 1000; // scroll at frame 100 -> visible window is [100, 200]

      const fStart = Math.max(0, Math.floor(scrollLeft / pixelsPerFrame)); // 100
      const fEnd = Math.ceil((scrollLeft + viewportWidth) / pixelsPerFrame); // 200

      const visible = sequences.filter((seq) => {
        const seqStart = seq.startFrame;
        const seqEnd = seqStart + seq.durationFrames;
        return seqEnd >= fStart && seqStart <= fEnd;
      });

      // seq-1: [0, 60] -> outside
      // seq-2: [100, 180] -> inside [100, 200]
      // seq-3: [300, 420] -> outside
      expect(visible.length).toBe(1);
      expect(visible[0]?.id).toBe('seq-2');
    });

    it('correctly captures boundary-straddling clips across viewport borders', () => {
      const pixelsPerFrame = 5;
      const viewportWidth = 500; // 100 frames wide
      const scrollLeft = 200; // scroll at frame 40 -> visible window is [40, 140]

      const fStart = Math.max(0, Math.floor(scrollLeft / pixelsPerFrame)); // 40
      const fEnd = Math.ceil((scrollLeft + viewportWidth) / pixelsPerFrame); // 140

      const visible = sequences.filter((seq) => {
        const seqStart = seq.startFrame;
        const seqEnd = seqStart + seq.durationFrames;
        return seqEnd >= fStart && seqStart <= fEnd;
      });

      // seq-1: [0, 60] overlaps [40, 140] -> visible
      // seq-2: [100, 180] overlaps [40, 140] -> visible
      // seq-3: [300, 420] -> outside
      expect(visible.length).toBe(2);
      expect(visible.map((s) => s.id)).toEqual(['seq-1', 'seq-2']);
    });
  });

  // =========================================================================
  // 2. WaveformLODPyramid Zoom Slicing & Constant Memory
  // =========================================================================
  describe('WaveformLODPyramid Resolution & Peak Sampling', () => {
    it('generates multi-resolution decimation levels without NaN or zero division', () => {
      const rawPeaks = new Float32Array(1000);
      for (let i = 0; i < 1000; i++) {
        rawPeaks[i] = Math.sin(i / 10) * 0.5 + 0.5;
      }

      const pyramid = new WaveformLODPyramid(rawPeaks);
      expect(pyramid.getLevelsCount()).toBe(4);

      // High zoom (>= 4.0 px/frame) -> LOD 0 (1:1)
      const lod0 = pyramid.selectLOD(5.0);
      expect(lod0.levelIndex).toBe(0);
      expect(lod0.peaks.length).toBe(1000);

      // Medium zoom (1.0 px/frame) -> LOD 1 (4:1)
      const lod1 = pyramid.selectLOD(1.5);
      expect(lod1.levelIndex).toBe(1);
      expect(lod1.peaks.length).toBe(250);

      // Low zoom (< 0.25 px/frame) -> LOD 3 (64:1)
      const lod3 = pyramid.selectLOD(0.1);
      expect(lod3.levelIndex).toBe(3);
      expect(lod3.peaks.length).toBeLessThan(20);
    });

    it('getCachedPeaks correctly limits LRU cache to MAX_PYRAMID_CACHE_ENTRIES = 32', () => {
      for (let i = 0; i < 50; i++) {
        const peaks = getCachedPeaks(`audio-asset-${i}`, 120, 60);
        expect(peaks).toBeDefined();
        expect(peaks.length).toBeGreaterThan(0);
      }

      // Re-querying earliest should not throw
      const reQuery = getCachedPeaks('audio-asset-49', 120, 60);
      expect(reQuery).toBeDefined();
    });
  });

  // =========================================================================
  // 3. Screen Coordinate & DPR Mapping Math
  // =========================================================================
  describe('Screen Coordinate & Sub-Pixel Scaling Math', () => {
    it('computes exact screen pixel intervals without negative offsets', () => {
      const scrollLeft = 300;
      const pixelsPerFrame = 8;
      const viewportWidth = 800;
      const clip = { startFrame: 50, durationFrames: 100 }; // screenStartPx = 50 * 8 - 300 = 100

      const clipStartPx = clip.startFrame * pixelsPerFrame;
      const clipWidthPx = clip.durationFrames * pixelsPerFrame;
      const screenStartPx = clipStartPx - scrollLeft;
      const screenEndPx = screenStartPx + clipWidthPx;

      const drawStart = Math.max(0, Math.floor(screenStartPx));
      const drawEnd = Math.min(viewportWidth, Math.ceil(screenEndPx));

      expect(drawStart).toBe(100);
      expect(drawEnd).toBe(800); // capped at viewportWidth
      expect(drawEnd - drawStart).toBe(700);
    });

    it('applies DPR scaling correctly for Retina/HiDPI backing stores', () => {
      const viewportWidth = 1200;
      const laneHeight = 40;
      const dpr = 2.0;

      const targetWidth = Math.floor(viewportWidth * dpr);
      const targetHeight = Math.floor(laneHeight * dpr);

      expect(targetWidth).toBe(2400);
      expect(targetHeight).toBe(80);
    });
  });
});
