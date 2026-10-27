import { describe, it, expect, beforeAll } from 'bun:test';
import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import { bootstrapNode } from '@acc/core';
import {
  type ResolvedTimeline,
  type ResolvedSequence,
  type ResolvedTrack,
} from '@acc/ir';
import { IRPreviewEngine } from '@acc/studio/renderer';

describe('Depth Diagnostic Preview Suite (Web & Node Parity)', () => {
  beforeAll(async () => {
    await bootstrapNode();
  });

  function createTestTimeline(): ResolvedTimeline {
    const seq: ResolvedSequence = {
      id: 'seq-vision-diag-1',
      trackId: 'track-v1',
      startFrame: 0,
      durationFrames: 60,
      endFrame: 60,
      type: 'video',
      modifiers: [
        {
          type: 'vfx/depth3d',
          params: {
            enabled: true,
            mode: 'parallax_25d',
            autoDepth: true,
          },
        },
      ],
    };

    const track: ResolvedTrack = {
      id: 'track-v1',
      type: 'video',
      sequences: [seq],
    };

    const sequencesMap = new Map<string, ResolvedSequence>();
    sequencesMap.set(seq.id, seq);

    const tracksMap = new Map<string, ResolvedTrack>();
    tracksMap.set(track.id, track);

    return {
      tracks: tracksMap,
      sequences: sequencesMap,
      totalFrames: 120,
      meta: {
        canvasSize: { w: 640, h: 360 },
        globalFps: 30,
      },
    };
  }

  it('renders standard frame and diagnostic depth heatmap without errors', () => {
    const timeline = createTestTimeline();
    const engine = new IRPreviewEngine(timeline);
    const canvas = UniversalCanvasProvider.createCanvas(640, 360);
    const ctx = canvas.getContext('2d');

    // 1. Standard preview frame
    const standardResult = engine.renderFrame(10, ctx, {
      clearColor: '#101014',
    });
    expect(standardResult.frame).toBe(10);
    expect(standardResult.activeSequences.length).toBe(1);

    // 2. Diagnostic depth heatmap transient option
    const diagResult = engine.renderFrame(10, ctx, {
      clearColor: '#101014',
      debugMode: 'depth_heatmap',
    });
    expect(diagResult.frame).toBe(10);
    expect(diagResult.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
