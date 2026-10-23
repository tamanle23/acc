import { describe, it, expect } from 'bun:test';
import { CanvasHitTester } from '../apps/studio/src/lib/hit-test/CanvasHitTester';
import type { ResolvedSequence } from '@acc/ir';

describe('CanvasHitTester Suite', () => {
  it('should compute subtitle hit region with safe zone bounds', () => {
    const subtitleSeq: ResolvedSequence = {
      id: 'sub_01',
      trackId: 'track_sub',
      startFrame: 0,
      durationFrames: 60,
      type: 'text' as any,
      cues: [
        {
          startFrame: 0,
          endFrame: 60,
          text: 'Welcome to the future of storytelling',
        },
      ],
      modifiers: [
        {
          type: 'text/style',
          params: {
            fontFamily: 'Inter',
            fontSize: 44,
            marginV: 80,
          },
        },
      ],
    } as any;

    const hit = CanvasHitTester.resolveSequenceRegion(subtitleSeq, 3, 'track_sub');
    expect(hit).toBeDefined();
    expect(hit?.sequenceType).toBe('text');
    expect(hit?.normX).toBe(0.5);
    expect(hit?.normY).toBeCloseTo(1.0 - 80 / 1080 - 0.04, 2);
    expect(hit?.label).toContain('Subtitle:');
    expect(hit?.zIndex).toBe(103);
  });

  it('should compute vector shape hit region from dimensions', () => {
    const shapeSeq: ResolvedSequence = {
      id: 'shape_rect',
      trackId: 'track_shape',
      startFrame: 0,
      durationFrames: 90,
      modifiers: [
        {
          type: 'shape/vector',
          params: {
            shapeType: 'rounded_box',
            width: 384,
            height: 216,
          },
        },
        {
          type: 'transform',
          params: {
            normX: 0.3,
            normY: 0.4,
          },
        },
      ],
    } as any;

    const hit = CanvasHitTester.resolveSequenceRegion(shapeSeq, 2, 'track_shape');
    expect(hit).toBeDefined();
    expect(hit?.sequenceType).toBe('shape');
    expect(hit?.normX).toBe(0.3);
    expect(hit?.normY).toBe(0.4);
    expect(hit?.normWidth).toBeCloseTo(384 / 1920, 3);
    expect(hit?.normHeight).toBeCloseTo(216 / 1080, 3);
  });

  it('should sort multiple hit regions by zIndex descending (higher tracks first)', () => {
    const seq1: ResolvedSequence = {
      id: 'video_bg',
      trackId: 'v1',
      startFrame: 0,
      durationFrames: 100,
      type: 'video' as any,
    } as any;

    const seq2: ResolvedSequence = {
      id: 'sub_hero',
      trackId: 'v3',
      startFrame: 0,
      durationFrames: 100,
      type: 'text' as any,
      cues: [{ startFrame: 0, endFrame: 100, text: 'Hello' }],
    } as any;

    const tracks = [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }];
    const regions = CanvasHitTester.computeHitRegions([seq1, seq2], tracks);

    expect(regions.length).toBe(2);
    expect(regions[0].sequenceId).toBe('sub_hero'); // Subtitle / Track 3 higher priority than background
    expect(regions[1].sequenceId).toBe('video_bg');
  });
});
