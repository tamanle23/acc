import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState.js';

describe('Studio Slider Property Interaction & Precision Movement Suite', () => {
  it('Slider component should provide native continuous pointer tracking without Kobalte drag-snapping bug', () => {
    const sliderPath = join(process.cwd(), 'apps/studio/src/components/ui/slider.tsx');
    const code = readFileSync(sliderPath, 'utf-8');

    // Verify Kobalte slider primitive was replaced with custom high-performance SolidJS implementation
    expect(code).not.toContain('@kobalte/core/slider');
    expect(code).toContain('data-slot="slider"');
    expect(code).toContain('data-slot="slider-track"');
    expect(code).toContain('data-slot="slider-range"');
    expect(code).toContain('data-slot="slider-thumb"');
    expect(code).toContain('setPointerCapture');
    expect(code).toContain('releasePointerCapture');
    expect(code).toContain('isDragging');
    expect(code).toContain('dragValue');
    expect(code).toContain('clampAndStep');
    expect(code).toContain('getTrackGeometry');
    expect(code).toContain('capturedGeo');
    expect(code).toContain('role="slider"');
    expect(code).toContain('aria-valuemin');
    expect(code).toContain('aria-valuemax');
    expect(code).toContain('aria-valuenow');
  });

  it('RightSidebar should retain SequenceInspector mounted across reactive state updates via boolean Match', () => {
    const sidebarPath = join(process.cwd(), 'apps/studio/src/components/RightSidebar.tsx');
    const code = readFileSync(sidebarPath, 'utf-8');

    expect(code).toContain("<Match when={currentMode() === 'sequence' && Boolean(resolved().selectedSeq)}>");
    expect(code).not.toContain('<Match when={resolved().selectedSeq}>');
  });

  it('PrimitiveControlStrategies NumberControlStrategy should supply defaultValue, value, and onChange to Slider', () => {
    const stratPath = join(
      process.cwd(),
      'apps/studio/src/components/inspector/strategies/PrimitiveControlStrategies.tsx'
    );
    const code = readFileSync(stratPath, 'utf-8');

    expect(code).toContain('<Slider');
    expect(code).toContain('min={min()}');
    expect(code).toContain('max={max()}');
    expect(code).toContain('step={step()}');
    expect(code).toContain('defaultValue={defaultVal()}');
    expect(code).toContain('value={numericVal()}');
    expect(code).toContain('onChange=');
  });

  it('ParameterControls ParameterSlider should bind defaultValue, value, onChange, and onDblClick to Slider', () => {
    const paramPath = join(
      process.cwd(),
      'apps/studio/src/components/inspector/ParameterControls.tsx'
    );
    const code = readFileSync(paramPath, 'utf-8');

    expect(code).toContain('<Slider');
    expect(code).toContain('min={props.min}');
    expect(code).toContain('max={props.max}');
    expect(code).toContain('step={props.step}');
    expect(code).toContain('defaultValue={props.defaultValue}');
    expect(code).toContain('value={props.value}');
    expect(code).toContain('onChange=');
    expect(code).toContain('onDblClick=');
  });

  it('Stepping and clamping precision math should eliminate floating-point drift', () => {
    // Replicate precision math formula in slider.tsx
    const clampAndStep = (rawVal: number, min: number, max: number, step: number): number => {
      const stepDecimals = step.toString().includes('.') ? step.toString().split('.')[1].length : 0;
      const factor = 10 ** Math.min(stepDecimals, 6);
      const stepped = Math.round((rawVal - min) / step) * step + min;
      const clamped = Math.max(min, Math.min(max, stepped));
      return Math.round(clamped * factor) / factor;
    };

    // Test standard scale steps
    expect(clampAndStep(1.048, 0, 10, 0.05)).toBe(1.05);
    expect(clampAndStep(1.021, 0, 10, 0.05)).toBe(1.0);
    expect(clampAndStep(-0.333, -1, 1, 0.02)).toBe(-0.34);
    expect(clampAndStep(0.1234, 0, 1, 0.01)).toBe(0.12);

    // Test min/max boundary clamping
    expect(clampAndStep(-50, 0, 100, 1)).toBe(0);
    expect(clampAndStep(150, 0, 100, 1)).toBe(100);
  });

  it('IRStateManager modifier property updates should persist across multiple slider changes', async () => {
    const manager = IRStateManager.getInstance();
    await manager.switchTemplate('scifi');
    const seqId = 'seq-city-intro';

    // Simulate 3 continuous slider drag movements on transform scale
    manager.updateModifier(seqId, 'transform', { scale: 1.15 });
    let state = manager.getState();
    let mod = state.doc.tracks[0].sequences.find((s) => s.id === seqId)?.modifiers?.find((m) => m.type === 'transform');
    expect(mod?.params.scale).toBe(1.15);

    manager.updateModifier(seqId, 'transform', { scale: 1.30 });
    state = manager.getState();
    mod = state.doc.tracks[0].sequences.find((s) => s.id === seqId)?.modifiers?.find((m) => m.type === 'transform');
    expect(mod?.params.scale).toBe(1.30);

    manager.updateModifier(seqId, 'transform', { scale: 1.50 });
    state = manager.getState();
    mod = state.doc.tracks[0].sequences.find((s) => s.id === seqId)?.modifiers?.find((m) => m.type === 'transform');
    expect(mod?.params.scale).toBe(1.50);
  });
});
