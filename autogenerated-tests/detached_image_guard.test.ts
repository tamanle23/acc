import { describe, it, expect } from 'bun:test';
import { wrapCanvasContext } from '../packages/core-isomorphic/src/canvas/wrapCanvasContext';
import { IRPreviewEngine } from '../apps/studio/src/renderer/IRPreviewEngine';
import type { ResolvedTimeline } from '../packages/ir/src/types/VideoIR';

describe('Detached Image Guard & Defensive Context Suite', () => {
  it('wrapCanvasContext guards against detached images with 0 dimensions without throwing', () => {
    let nativeDrawImageCalls = 0;
    const mockRawCtx = {
      drawImage: (_image: any, ..._args: any[]) => {
        nativeDrawImageCalls++;
      },
      createPattern: (_image: any, _rep: any) => {
        return { pattern: true };
      },
    };

    const safeCtx = wrapCanvasContext(mockRawCtx);

    // 1. Normal valid source should be drawn
    const validImg = { width: 1920, height: 1080 };
    safeCtx.drawImage(validImg, 0, 0);
    expect(nativeDrawImageCalls).toBe(1);

    // 2. Detached ImageBitmap (width: 0, height: 0) should be gracefully skipped
    const detachedBmp = { width: 0, height: 0 };
    expect(() => {
      safeCtx.drawImage(detachedBmp, 0, 0);
    }).not.toThrow();
    // Native drawImage should NOT have been invoked for detached bitmap
    expect(nativeDrawImageCalls).toBe(1);

    // 3. Closed VideoFrame (displayWidth: 0) should be gracefully skipped
    const closedVideoFrame = { displayWidth: 0, displayHeight: 0 };
    expect(() => {
      safeCtx.drawImage(closedVideoFrame, 0, 0);
    }).not.toThrow();
    expect(nativeDrawImageCalls).toBe(1);

    // 4. Null / undefined source should be gracefully skipped
    expect(() => {
      safeCtx.drawImage(null as any, 0, 0);
      safeCtx.drawImage(undefined as any, 0, 0);
    }).not.toThrow();
    expect(nativeDrawImageCalls).toBe(1);
  });

  it('wrapCanvasContext catches native InvalidStateError on detached buffers without crashing', () => {
    const throwingRawCtx = {
      drawImage: (_image: any, ..._args: any[]) => {
        const err = new Error("Failed to execute 'drawImage' on 'OffscreenCanvasRenderingContext2D': The image source is detached");
        err.name = 'InvalidStateError';
        throw err;
      },
    };

    const safeCtx = wrapCanvasContext(throwingRawCtx);

    // Even if dimension check is bypassed (e.g. non-zero dimensions reported by mock), InvalidStateError is caught
    const deceptiveBmp = { width: 100, height: 100 };
    expect(() => {
      safeCtx.drawImage(deceptiveBmp, 0, 0);
    }).not.toThrow();
  });

  it('IRPreviewEngine.renderFrame does not produce unhandled promise rejections', async () => {
    const mockTimeline: ResolvedTimeline = {
      meta: {
        globalFps: 30,
        totalFrames: 100,
        width: 1920,
        height: 1080,
      },
      tracks: new Map(),
      sequences: new Map(),
    };

    const engine = new IRPreviewEngine(mockTimeline, undefined, undefined, 48000, {
      sidecarCoordinator: null,
      autoPreflight: false,
    });

    const mockCtx = {
      save: () => {},
      restore: () => {},
      clearRect: () => {},
      fillRect: () => {},
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
    };

    // Synchronous renderFrame call should return frame result immediately and catch inner async compositor errors
    const res = engine.renderFrame(10, mockCtx as any);
    expect(res.frame).toBe(10);
    expect(res.timestampSeconds).toBeCloseTo(10 / 30, 4);

    // Async renderFrameAsync should resolve cleanly
    const asyncRes = await engine.renderFrameAsync(15, mockCtx as any);
    expect(asyncRes.frame).toBe(15);
    expect(asyncRes.timestampSeconds).toBeCloseTo(15 / 30, 4);
  });
});
