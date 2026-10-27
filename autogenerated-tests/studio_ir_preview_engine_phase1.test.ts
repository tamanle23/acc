import { describe, it, expect } from 'bun:test';
import {
  HologramHUDPlugin,
  PartialVFXPlugin,
  evaluateSequenceMotion,
  evaluateEase,
  RelationalDAGCompiler,
  type VideoIRDocument,
} from '@acc/ir';
import {
  IRPreviewEngine,
  AssetTextureCache,
} from '@acc/studio';

// Mock 2D Canvas Context for test execution
function createMockCanvasContext() {
  const calls: string[] = [];
  return {
    calls,
    canvas: { width: 1920, height: 1080 },
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    translate: (x: number, y: number) => calls.push(`translate(${x},${y})`),
    rotate: (r: number) => calls.push(`rotate(${r.toFixed(2)})`),
    scale: (sx: number, sy: number) => calls.push(`scale(${sx.toFixed(2)},${sy.toFixed(2)})`),
    fillRect: (x: number, y: number, w: number, h: number) => calls.push(`fillRect(${x},${y},${w},${h})`),
    beginPath: () => calls.push('beginPath'),
    arc: (x: number, y: number, r: number) => calls.push(`arc(${x},${y},${r.toFixed(2)})`),
    stroke: () => calls.push('stroke'),
    fill: () => calls.push('fill'),
    moveTo: (x: number, y: number) => calls.push(`moveTo(${x},${y})`),
    lineTo: (x: number, y: number) => calls.push(`lineTo(${x},${y})`),
    strokeRect: (x: number, y: number, w: number, h: number) => calls.push(`strokeRect(${x},${y},${w},${h})`),
    setLineDash: (d: number[]) => calls.push(`setLineDash([${d.join(',')}])`),
    createRadialGradient: () => ({
      addColorStop: () => {},
    }),
    drawImage: () => calls.push('drawImage'),
    globalCompositeOperation: 'source-over',
    globalAlpha: 1.0,
    fillStyle: '#000000',
    strokeStyle: '#ffffff',
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D & { calls: string[] };
}

describe('Iteration 9 Phase 1: IRPreviewEngine & New Modifier Plugins', () => {
  it('DeterministicMotionEvaluator evaluates standard easing curves accurately', () => {
    expect(evaluateEase('linear', 0.5)).toBe(0.5);
    expect(evaluateEase('power1.in', 0.5)).toBe(0.25);
    expect(evaluateEase('power1.out', 0.5)).toBe(0.75);
    expect(evaluateEase('power2.inOut', 0.0)).toBe(0.0);
    expect(evaluateEase('power2.inOut', 1.0)).toBe(1.0);
    expect(evaluateEase('bounce.out', 1.0)).toBe(1.0);
    expect(evaluateEase('back.out', 1.0)).toBeCloseTo(1.0, 4);
  });

  it('evaluateSequenceMotion computes 3-stage lifecycle state functionally', () => {
    const tp = {
      x: 100,
      y: 50,
      scale: 1.2,
      rotation: 15,
      animation: { preset: 'pop_in', intro: { durationSec: 0.5 } },
    };

    // At t = 0 (intro start)
    const stateStart = evaluateSequenceMotion(tp, 0, 3.0);
    expect(stateStart.opacity).toBe(0);
    expect(stateStart.scale).toBeLessThan(1.2);

    // At t = 1.0 (steady state)
    const stateSteady = evaluateSequenceMotion(tp, 1.0, 3.0);
    expect(stateSteady.opacity).toBe(1.0);
    expect(stateSteady.scale).toBe(1.2);
    expect(stateSteady.x).toBe(100);
    expect(stateSteady.y).toBe(50);
  });

  it('HologramHUDPlugin renders closed-form cybernetic telemetry', () => {
    const plugin = new HologramHUDPlugin();
    expect(plugin.type).toBe('overlay/hologram_hud');
    expect(plugin.targetScope).toBe('both');

    const mockCtx = createMockCanvasContext();
    plugin.drawHUD(mockCtx, 1920, 1080, 2.0, {
      ringRadius: 0.4,
      color: '#00ffff',
      rotationSpeed: 0.5,
    });

    expect(mockCtx.calls).toContain('save');
    expect(mockCtx.calls).toContain('beginPath');
    expect(mockCtx.calls).toContain('stroke');
    expect(mockCtx.calls).toContain('restore');
  });

  it('PartialVFXPlugin renders spotlight, glitch, blur, and point_emitter', () => {
    const plugin = new PartialVFXPlugin();
    expect(plugin.type).toBe('vfx/partial');

    const mockCtx = createMockCanvasContext();
    plugin.drawPartialVFX(mockCtx, 1920, 1080, 1.5, {
      regions: [
        { type: 'spotlight', x: 0.5, y: 0.5, radius: 100, color: '#ff00ff' },
        { type: 'glitch', x: 0.3, y: 0.3, width: 0.2, height: 0.1 },
        { type: 'blur', x: 0.7, y: 0.7, width: 0.2, height: 0.1 },
        { type: 'point_emitter', x: 0.5, y: 0.8, intensity: 1.2 },
      ],
    });

    expect(mockCtx.calls.length).toBeGreaterThan(10);
    expect(mockCtx.calls).toContain('save');
    expect(mockCtx.calls).toContain('restore');
  });

  it('AssetTextureCache correctly manages texture objects and keys', () => {
    const cache = new AssetTextureCache();
    cache.set('tex1', { width: 1920, height: 1080 });
    expect(cache.has('tex1')).toBe(true);
    expect(cache.get('tex1').width).toBe(1920);

    cache.delete('tex1');
    expect(cache.has('tex1')).toBe(false);

    cache.set('tex2', { width: 800, height: 600 });
    cache.clear();
    expect(cache.has('tex2')).toBe(false);
  });

  it('IRPreviewEngine performs deterministic seeks and canvas renderFrame', async () => {
    const doc: VideoIRDocument = {
      version: '1.0.0-stable',
      meta: {
        contentId: 'test_preview_doc',
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      },
      tracks: [
        {
          id: 'v1',
          type: 'video',
          style: { trackIndex: 0 },
          sequences: [
            {
              id: 'seq1',
              type: 'video',
              trackId: 'v1',
              time: {
                start: 0,
                duration: 60,
              },
              modifiers: [
                {
                  target: 'video',
                  type: 'overlay/hologram_hud',
                  params: { ringRadius: 0.3, color: '#00ffff' },
                },
              ],
            },
          ],
        },
      ],
    };

    const compiler = new RelationalDAGCompiler();
    const timeline = await compiler.compile(doc);

    const engine = new IRPreviewEngine(timeline);

    // 1. Seek
    const seekResult = engine.seek(15);
    expect(seekResult.frame).toBe(15);
    expect(seekResult.timestampSeconds).toBe(0.5);
    expect(seekResult.activeSequences.length).toBe(1);
    expect(seekResult.activeSequences[0].id).toBe('seq1');

    // 2. Render Frame
    const mockCtx = createMockCanvasContext();
    const renderResult = engine.renderFrame(15, mockCtx);
    expect(renderResult.frame).toBe(15);
    expect(mockCtx.calls).toContain('fillRect(0,0,1920,1080)');
    expect(mockCtx.calls).toContain('save');
    expect(mockCtx.calls).toContain('restore');
  });
});
