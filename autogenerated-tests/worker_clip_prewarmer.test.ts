import { describe, it, expect, beforeEach } from 'bun:test';
import { WorkerClipPrewarmer } from '../apps/studio/src/renderer/workers/WorkerClipPrewarmer';
import { PreviewFrameMemoryManager } from '../apps/studio/src/renderer/workers/PreviewFrameMemoryManager';
import type { ResolvedTimeline } from '@acc/ir';

describe('WorkerClipPrewarmer Suite', () => {
  beforeEach(() => {
    PreviewFrameMemoryManager.getInstance().clear();
  });

  it('scans upcoming window [currentFrame, currentFrame + 1.5s] and triggers pre-warming', async () => {
    const mockReaders = new Map<string, any>();
    let requestedFrames: number[] = [];

    mockReaders.set('asset-scene-2', {
      requestFrame: async (frame: number) => {
        requestedFrames.push(frame);
        return {
          width: 1920,
          height: 1080,
          close: () => { },
        } as unknown as ImageBitmap;
      },
    });

    const prewarmer = new WorkerClipPrewarmer(mockReaders);

    const dummyTimeline: ResolvedTimeline = {
      meta: {
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
        colorSpace: 'srgb',
      },
      tracks: new Map([
        [
          'track-v1',
          {
            id: 'track-v1',
            type: 'video',
            name: 'V1',
            sequences: [
              {
                id: 'seq-1',
                type: 'video',
                assetId: 'asset-scene-1',
                startFrame: 0,
                durationFrames: 60,
                endFrame: 60,
              },
              {
                id: 'seq-2',
                type: 'video',
                assetId: 'asset-scene-2',
                startFrame: 70, // Starts at frame 70
                durationFrames: 60,
                endFrame: 130,
              },
            ],
          } as any,
        ],
      ]),
      sequences: new Map(),
      totalFrames: 300,
      totalDurationSec: 10,
    };

    prewarmer.setTimeline(dummyTimeline);

    // At frame 10 (1.5s = 45 frames @ 30fps -> window is [10, 55]).
    // seq-2 starts at 70, so it shouldn't be pre-warmed yet.
    prewarmer.prewarmUpcomingClips(10, 30);
    expect(requestedFrames.length).toBe(0);

    // At frame 30 (window is [30, 75]).
    // seq-2 starts at 70, which is inside [30, 75]. It should trigger prewarm of local frame 0 (hero frame)!
    prewarmer.prewarmUpcomingClips(30, 30);

    // Allow promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(requestedFrames).toEqual([0]);

    // Calling again at frame 35 shouldn't re-trigger because it's already warmed
    prewarmer.prewarmUpcomingClips(35, 30);
    expect(requestedFrames.length).toBe(1);
  });
});
