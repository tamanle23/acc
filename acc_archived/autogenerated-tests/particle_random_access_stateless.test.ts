import { describe, it, expect } from 'bun:test';
import { CanvasParticleOverlayPlugin } from '../packages/ir/src/plugins/overlay/CanvasParticleOverlayPlugin';
import { UniversalCanvasProvider } from '../packages/effect-engines';
import { createHash } from 'crypto';

function hashCanvas(canvasCtx: any, width: number, height: number): string {
  const imgData = canvasCtx.getImageData(0, 0, width, height);
  return createHash('sha256').update(Buffer.from(imgData.data.buffer)).digest('hex');
}

describe('Iteration 12: Deterministic Random-Access Particle Overlay Tests', () => {
  it('guarantees identical pixel hash at frame 45 regardless of seek trajectory', async () => {
    const plugin = new CanvasParticleOverlayPlugin();
    const width = 320;
    const height = 180;

    const uCanvasA = UniversalCanvasProvider.createCanvas(width, height);
    const canvasA = uCanvasA.getRawCanvas ? uCanvasA.getRawCanvas() : uCanvasA;
    const ctxA = canvasA.getContext('2d');

    const uCanvasB = UniversalCanvasProvider.createCanvas(width, height);
    const canvasB = uCanvasB.getRawCanvas ? uCanvasB.getRawCanvas() : uCanvasB;
    const ctxB = canvasB.getContext('2d');

    const mockTrack: any = { id: 'track-stateless-test' };
    const params = { type: 'embers', intensity: 1.2, speed: 1.0 };

    // Run A: Sequential playback 0 -> 45
    for (let f = 0; f <= 45; f++) {
      ctxA.clearRect(0, 0, width, height);
      plugin.renderStreamSpace(
        {
          canvas: canvasA,
          ctx: ctxA,
          frame: f,
          width,
          height,
          track: mockTrack,
          activeSequences: [],
        },
        params
      );
    }
    const hashAt45Sequential = hashCanvas(ctxA, width, height);

    // Run B: Scrub backward from frame 100 directly to 45
    for (let f = 100; f >= 50; f -= 10) {
      ctxB.clearRect(0, 0, width, height);
      plugin.renderStreamSpace(
        {
          canvas: canvasB,
          ctx: ctxB,
          frame: f,
          width,
          height,
          track: mockTrack,
          activeSequences: [],
        },
        params
      );
    }
    // Now seek directly to 45
    ctxB.clearRect(0, 0, width, height);
    plugin.renderStreamSpace(
      {
        canvas: canvasB,
        ctx: ctxB,
        frame: 45,
        width,
        height,
        track: mockTrack,
        activeSequences: [],
      },
      params
    );
    const hashAt45Rewind = hashCanvas(ctxB, width, height);

    // Assert 100% bit-identical hash parity
    expect(hashAt45Sequential).toBe(hashAt45Rewind);
  });

  it('verifies all particle presets execute statelessly without throwing', () => {
    const plugin = new CanvasParticleOverlayPlugin();
    const width = 160;
    const height = 90;
    const uCanvas = UniversalCanvasProvider.createCanvas(width, height);
    const canvas = uCanvas.getRawCanvas ? uCanvas.getRawCanvas() : uCanvas;
    const ctx = canvas.getContext('2d');

    const presets = [
      'snow',
      'rain',
      'dust',
      'embers',
      'fire',
      'smoke',
      'fog',
      'bokeh',
      'digital_glitch',
      'vhs',
      'sci_fi_hud',
    ];

    for (const p of presets) {
      ctx.clearRect(0, 0, width, height);
      plugin.renderStreamSpace(
        {
          canvas,
          ctx,
          frame: 37,
          width,
          height,
          track: { id: `track-${p}` } as any,
          activeSequences: [],
        },
        { type: p, intensity: 1.0 }
      );
    }

    expect(true).toBe(true);
  });
});
