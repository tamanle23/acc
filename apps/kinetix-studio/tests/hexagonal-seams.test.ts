// ============================================================================
// KINETIX STUDIO - HEXAGONAL PORTS & ADAPTERS SEAMS VERIFICATION SUITE
// Verifies boundary decoupling, dependency inversion container, headless
// rendering abstraction, and pure domain isolation without DOM dependencies.
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { IRenderTargetPort } from '@/core/ports/driven/render-target.port';
import {
  getContainer,
  setContainerOverride,
  createProductionContainer,
  type StudioContainer,
} from '@/core/container';
import { Canvas2dRenderTargetAdapter } from '@/adapters/driven/canvas2d/canvas2d-target.adapter';
import { SafeCanvas2D } from '@/lib/safe-canvas-2d';
import { UnitBezier, evaluateBezierTrack } from '@/core/domain/motion';
import { rgbToCmyk, calculateTotalAreaCoverage, formatPdfDeviceCmyk } from '@/core/domain/color';

// Mock Headless Render Target for headless verification
class HeadlessMockRenderTarget implements IRenderTargetPort {
  public readonly calls: string[] = [];
  public width: number;
  public height: number;

  constructor(w = 1080, h = 1920) {
    this.width = w;
    this.height = h;
  }

  save(): void { this.calls.push('save'); }
  restore(): void { this.calls.push('restore'); }
  translate(x: number, y: number): void { this.calls.push(`translate(${x},${y})`); }
  scale(x: number, y: number): void { this.calls.push(`scale(${x},${y})`); }
  rotate(rad: number): void { this.calls.push(`rotate(${rad})`); }
  beginPath(): void { this.calls.push('beginPath'); }
  closePath(): void { this.calls.push('closePath'); }
  moveTo(x: number, y: number): void { this.calls.push(`moveTo(${x},${y})`); }
  lineTo(x: number, y: number): void { this.calls.push(`lineTo(${x},${y})`); }
  arc(): void { this.calls.push('arc'); }
  bezierCurveTo(): void { this.calls.push('bezierCurveTo'); }
  quadraticCurveTo(): void { this.calls.push('quadraticCurveTo'); }
  rect(x: number, y: number, w: number, h: number): void { this.calls.push(`rect(${x},${y},${w},${h})`); }
  clearRect(): void { this.calls.push('clearRect'); }
  fillRect(x: number, y: number, w: number, h: number): void { this.calls.push(`fillRect(${x},${y},${w},${h})`); }
  strokeRect(): void { this.calls.push('strokeRect'); }
  fill(): void { this.calls.push('fill'); }
  stroke(): void { this.calls.push('stroke'); }
  clip(): void { this.calls.push('clip'); }
  fillText(text: string): void { this.calls.push(`fillText(${text})`); }
  strokeText(): void { this.calls.push('strokeText'); }
  measureText(text: string): { width: number } { return { width: text.length * 10 }; }
  setFillStyle(color: unknown): void { this.calls.push(`fillStyle=${color}`); }
  setStrokeStyle(color: unknown): void { this.calls.push(`strokeStyle=${color}`); }
  setLineWidth(w: number): void { this.calls.push(`lineWidth=${w}`); }
  setGlobalAlpha(a: number): void { this.calls.push(`globalAlpha=${a}`); }
  setGlobalCompositeOperation(op: string): void { this.calls.push(`composite=${op}`); }
  setFont(f: string): void { this.calls.push(`font=${f}`); }
  setTextAlign(): void { this.calls.push('textAlign'); }
  setTextBaseline(): void { this.calls.push('textBaseline'); }
  async toBlob(): Promise<Blob | null> { return new Blob(['mock-binary'], { type: 'image/png' }); }
  getImageData(): ImageData | null { return null; }
}

describe('Hexagonal Seams & Domain Decoupling Suite (Milestone 0)', () => {
  beforeEach(() => {
    setContainerOverride(null);
  });

  afterEach(() => {
    setContainerOverride(null);
  });

  it('resolves the default production container cleanly', () => {
    const container = getContainer();
    expect(container).toBeDefined();
    expect(typeof container.createRenderTarget).toBe('function');
    expect(container.downloadTransport).toBeDefined();
    expect(typeof container.downloadTransport.downloadBlob).toBe('function');
  });

  it('allows overriding container services with test doubles', () => {
    const mockTarget = new HeadlessMockRenderTarget(500, 500);
    const mockContainer: StudioContainer = {
      createRenderTarget: () => mockTarget,
      downloadTransport: {
        downloadBlob: () => {},
        saveToFileHandle: async () => true,
      },
    };

    setContainerOverride(mockContainer);
    const active = getContainer();
    const createdTarget = active.createRenderTarget(100, 100);

    expect(createdTarget).toBe(mockTarget);
    expect(createdTarget.width).toBe(500);
  });

  it('supports headless rendering instructions via IRenderTargetPort', async () => {
    const target = new HeadlessMockRenderTarget(1080, 1920);

    target.save();
    target.translate(100, 200);
    target.setFillStyle('#ff0055');
    target.fillRect(0, 0, 400, 300);
    target.fillText('KINETIX LIVE');
    target.restore();

    expect(target.calls).toContain('save');
    expect(target.calls).toContain('translate(100,200)');
    expect(target.calls).toContain('fillStyle=#ff0055');
    expect(target.calls).toContain('fillRect(0,0,400,300)');
    expect(target.calls).toContain('fillText(KINETIX LIVE)');
    expect(target.calls).toContain('restore');

    const blob = await target.toBlob();
    expect(blob).not.toBeNull();
    expect(blob?.type).toBe('image/png');
  });

  it('validates SafeCanvas2D constructor broadening with 2D contexts', () => {
    // Duck-typed OffscreenCanvasRenderingContext2D test double
    const fakeOffscreenCtx = {
      canvas: { width: 1920, height: 1080 },
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      closePath: () => {},
      stroke: () => {},
      fill: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      arc: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillText: () => {},
      measureText: (text: string) => ({ width: text.length * 8 }),
    } as unknown as OffscreenCanvasRenderingContext2D;

    const sctx = new SafeCanvas2D(fakeOffscreenCtx);
    expect(sctx).toBeDefined();
    expect(sctx.raw).toBe(fakeOffscreenCtx);

    const adapter = new Canvas2dRenderTargetAdapter(fakeOffscreenCtx);
    expect(adapter.width).toBe(1920);
    expect(adapter.height).toBe(1080);
    expect(adapter.measureText('HELLO').width).toBe(40);
  });

  it('verifies pure domain motion models run without DOM dependencies', () => {
    const bezier = new UnitBezier(0.25, 0.1, 0.25, 1.0);
    expect(bezier.solve(0)).toBe(0);
    expect(bezier.solve(1)).toBe(1);
    expect(bezier.solve(0.5)).toBeGreaterThan(0);
    expect(bezier.getVelocity(0.5)).toBeGreaterThan(0);

    const knots = [
      { t: 0, val: 0.1 },
      { t: 0.5, val: 0.9 },
      { t: 1.0, val: 0.1 },
    ];
    const valAtHalf = evaluateBezierTrack(knots, 0.5);
    expect(valAtHalf).toBeCloseTo(0.9, 1);
  });

  it('verifies pure domain color models run without DOM dependencies', () => {
    const cmyk = rgbToCmyk(0.2, 0.8, 0.4);
    expect(cmyk.c).toBeGreaterThan(0);
    expect(cmyk.m).toBe(0);
    expect(cmyk.y).toBeGreaterThan(0);

    const tac = calculateTotalAreaCoverage(cmyk);
    expect(tac).toBeLessThanOrEqual(300);

    const pdfOp = formatPdfDeviceCmyk(cmyk, 'k');
    expect(pdfOp.endsWith('k')).toBe(true);
  });
});
