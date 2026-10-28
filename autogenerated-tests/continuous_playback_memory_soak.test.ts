import { describe, it, expect, beforeEach } from 'bun:test';
import {
  NativeResourceManager,
  UniversalCanvasProvider,
} from '@acc/core-isomorphic';
import { NapiCanvasAdapter } from '../packages/core/src/native';
import { Depth3DPlugin } from '../packages/ir/src/plugins/vfx/Depth3DPlugin';
import { Camera3DPlugin } from '../packages/ir/src/plugins/vfx/Camera3DPlugin';
import { SequentialVideoReader } from '../apps/studio/src/renderer/workers/SequentialVideoReader';

describe('Continuous Playback Memory Soak Test (600 Frames / 20+ Seconds)', () => {
  beforeEach(() => {
    UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);
    const mgr = NativeResourceManager.getInstance();
    mgr.setMaxGpuBytes(64 * 1024 * 1024);
  });

  it('guarantees native memory flatlines strictly below 64MB across 600 continuous playback frames', async () => {
    const mgr = NativeResourceManager.getInstance();
    const depthPlugin = new Depth3DPlugin();
    const cameraPlugin = new Camera3DPlugin();

    const width = 1280;
    const height = 720;

    const baseCanvas = UniversalCanvasProvider.createCanvas(width, height);
    const bCtx = baseCanvas.getContext('2d');
    bCtx.fillStyle = 'blue';
    bCtx.fillRect(0, 0, width, height);

    const targetCanvas = UniversalCanvasProvider.createCanvas(width, height);
    const targetCtx = targetCanvas.getContext('2d');

    const videoCanvas = UniversalCanvasProvider.createCanvas(width, height);
    const mockSink = {
      getCanvas: async () => videoCanvas,
    };
    const videoReader = new SequentialVideoReader(mockSink as any, width, height);

    const sequenceId = 'seq-soak-composite';
    const sequence = {
      id: sequenceId,
      type: 'image',
      durationFrames: 600,
    };

    let sampleAtFrame10 = { totalBytes: 0, resourceCount: 0 };
    let maxObservedBytes = 0;

    // Run continuous 600-frame playback simulation (20 seconds of real-time 30fps playback)
    for (let frame = 0; frame < 600; frame++) {
      // 1. Scoped Frame Execution (RAII)
      const frameScope = mgr.createFrameScope(`frame-${frame}`);

      try {
        // 2. Sequential Video Streamer (2-slot OffscreenCanvas ping-pong)
        const frameTexture = await videoReader.getFrameCanvas(frame, 30);
        expect(frameTexture).toBeDefined();

        // 3. Modifier 1: Depth3D Plugin (Zero-alloc sequence-scoped textures)
        await depthPlugin.renderClipSpace(
          {
            ctx: targetCtx,
            width,
            height,
            localFrame: frame,
            sequence: sequence as any,
            baseAsset: baseCanvas.getRawCanvas ? baseCanvas.getRawCanvas() : baseCanvas,
          } as any,
          { mode: 'frame_breaker' }
        );

        // 4. Modifier 2: Camera3D Plugin (Zero-alloc camera trajectory)
        await cameraPlugin.renderClipSpace(
          {
            ctx: targetCtx,
            width,
            height,
            localFrame: frame,
            sequence: sequence as any,
          } as any,
          { fov: 55, roll: 0.5 }
        );

        // Track native GPU memory statistics
        const currentBytes = mgr.getCurrentBytes();
        if (currentBytes > maxObservedBytes) {
          maxObservedBytes = currentBytes;
        }

        // Hard ceiling invariant: MUST never breach 64MB
        expect(currentBytes).toBeLessThanOrEqual(64 * 1024 * 1024);

        if (frame === 10) {
          sampleAtFrame10 = {
            totalBytes: currentBytes,
            resourceCount: mgr.getStats().resourceCount,
          };
        }
      } finally {
        frameScope.dispose();
      }
    }

    const finalStats = mgr.getStats();

    // Verification 1: Hard ceiling respected throughout the entire 600-frame run
    expect(maxObservedBytes).toBeLessThanOrEqual(64 * 1024 * 1024);

    // Verification 2: Zero memory accumulation between frame 10 and frame 600 (Strict Flatline)
    expect(finalStats.totalBytes).toBe(sampleAtFrame10.totalBytes);
    expect(finalStats.resourceCount).toBe(sampleAtFrame10.resourceCount);

    // Verification 3: Sequence disposal cleans up completely
    depthPlugin.cleanupSequence(sequenceId);
    cameraPlugin.cleanupSequence(sequenceId);
    videoReader.dispose();

    expect(mgr.getCurrentBytes()).toBeLessThan(sampleAtFrame10.totalBytes);
  });
});
