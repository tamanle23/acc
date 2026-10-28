import { describe, it, expect, beforeEach } from 'bun:test';
import {
  NativeResourceManager,
  UniversalCanvasProvider,
} from '@acc/core-isomorphic';
import { NapiCanvasAdapter } from '../packages/core/src/native';
import { Depth3DPlugin } from '../packages/ir/src/plugins/vfx/Depth3DPlugin';
import { Camera3DPlugin } from '../packages/ir/src/plugins/vfx/Camera3DPlugin';

describe('Phase 2: Strict Zero-Alloc Frame Loop in IR Plugins', () => {
  beforeEach(() => {
    UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);
    const mgr = NativeResourceManager.getInstance();
    mgr.setMaxGpuBytes(64 * 1024 * 1024);
  });

  it('Depth3DPlugin flatlines native memory across 100 consecutive frames', async () => {
    const mgr = NativeResourceManager.getInstance();
    const plugin = new Depth3DPlugin();

    const width = 320;
    const height = 240;
    const baseCanvas = UniversalCanvasProvider.createCanvas(width, height);
    const bCtx = baseCanvas.getContext('2d');
    bCtx.fillStyle = 'red';
    bCtx.fillRect(0, 0, width, height);

    const targetCanvas = UniversalCanvasProvider.createCanvas(width, height);
    const canvasCtx = targetCanvas.getContext('2d');

    const sequenceId = 'seq-depth3d-test';
    const sequence = {
      id: sequenceId,
      type: 'image',
      durationFrames: 100,
    };

    // Frame 0: Initialization / first frame
    await plugin.renderClipSpace(
      {
        ctx: canvasCtx,
        width,
        height,
        localFrame: 0,
        sequence: sequence as any,
        baseAsset: baseCanvas.getRawCanvas ? baseCanvas.getRawCanvas() : baseCanvas,
      } as any,
      { mode: 'frame_breaker' }
    );

    const initialStats = mgr.getStats();

    // Render 100 consecutive frames (simulating 30fps playback loop)
    for (let frame = 1; frame <= 100; frame++) {
      await plugin.renderClipSpace(
        {
          ctx: canvasCtx,
          width,
          height,
          localFrame: frame,
          sequence: sequence as any,
          baseAsset: baseCanvas.getRawCanvas ? baseCanvas.getRawCanvas() : baseCanvas,
        } as any,
        { mode: 'frame_breaker' }
      );
    }

    const after100Stats = mgr.getStats();

    // Zero-alloc loop: byte size and resource count MUST be completely identical
    expect(after100Stats.totalBytes).toBe(initialStats.totalBytes);
    expect(after100Stats.resourceCount).toBe(initialStats.resourceCount);

    // Cleanup sequence removes registered resources
    plugin.cleanupSequence(sequenceId);
    const postCleanupStats = mgr.getStats();
    expect(postCleanupStats.totalBytes).toBeLessThan(initialStats.totalBytes);
  });

  it('Camera3DPlugin flatlines native memory across 100 consecutive frames', async () => {
    const mgr = NativeResourceManager.getInstance();
    const plugin = new Camera3DPlugin();

    const width = 320;
    const height = 240;
    const targetCanvas = UniversalCanvasProvider.createCanvas(width, height);
    const canvasCtx = targetCanvas.getContext('2d');

    const sequenceId = 'seq-camera3d-test';
    const sequence = {
      id: sequenceId,
      durationFrames: 100,
    };

    // Frame 0
    await plugin.renderClipSpace(
      {
        ctx: canvasCtx,
        width,
        height,
        localFrame: 0,
        sequence: sequence as any,
      } as any,
      {
        fov: 60,
        focalDistance: 2.0,
        bokehRadius: 5.0,
      }
    );

    const initialStats = mgr.getStats();

    // Render 100 frames
    for (let frame = 1; frame <= 100; frame++) {
      await plugin.renderClipSpace(
        {
          ctx: canvasCtx,
          width,
          height,
          localFrame: frame,
          sequence: sequence as any,
        } as any,
        {
          fov: 60,
          focalDistance: 2.0,
          bokehRadius: 5.0,
        }
      );
    }

    const after100Stats = mgr.getStats();
    expect(after100Stats.totalBytes).toBe(initialStats.totalBytes);
    expect(after100Stats.resourceCount).toBe(initialStats.resourceCount);

    plugin.cleanupSequence(sequenceId);
    expect(mgr.getStats().resourceCount).toBeLessThanOrEqual(initialStats.resourceCount);
  });
});
