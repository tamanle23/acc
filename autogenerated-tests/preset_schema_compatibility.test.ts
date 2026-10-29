import { describe, it, expect } from 'bun:test';
import { STAGING_PRESETS } from '../apps/studio/src/lib/library/stagingPresets';
import { FOOTAGE_PRESETS } from '../apps/studio/src/lib/library/footageBank';
import { AUDIO_PRESETS } from '../apps/studio/src/lib/library/audioFootageBank';
import { ShapeModifierPlugin } from '../packages/ir/src/plugins/shape/ShapeModifierPlugin';
import { PartialVFXPlugin } from '../packages/ir/src/plugins/vfx/PartialVFXPlugin';

describe('Library Presets Schema Compatibility & Plugin Normalization Suite', () => {
  it('validates all STAGING_PRESETS produce valid sequences with proper parameters', () => {
    expect(STAGING_PRESETS.length).toBeGreaterThan(0);

    for (const preset of STAGING_PRESETS) {
      const seq = preset.createSequence({ startFrame: 0, normX: 0.5, normY: 0.5 });
      expect(seq.id).toBeTruthy();
      expect(seq.name).toBeTruthy();
      expect(seq.type).toBeTruthy();
      expect(seq.time).toBeDefined();
      expect(typeof seq.time.start).toBe('number');
      expect(typeof seq.time.duration).toBe('number');

      // Check shape presets geometry & cornerRadius
      const shapeMod = seq.modifiers?.find((m) => m.type === 'shape/vector');
      if (shapeMod) {
        expect(['rounded_rect', 'circle', 'arrow']).toContain(shapeMod.params?.geometry as string);
        if (shapeMod.params?.geometry === 'rounded_rect') {
          expect(typeof shapeMod.params?.cornerRadius).toBe('number');
        }
      }

      // Check partial VFX presets regions structure
      const partialVfxMod = seq.modifiers?.find((m) => m.type === 'vfx/partial');
      if (partialVfxMod) {
        expect(Array.isArray(partialVfxMod.params?.regions)).toBe(true);
        expect((partialVfxMod.params?.regions as any[]).length).toBeGreaterThan(0);
      }
    }
  });

  it('validates all FOOTAGE_PRESETS have valid video track and sequence types', () => {
    expect(FOOTAGE_PRESETS.length).toBeGreaterThan(0);

    for (const footage of FOOTAGE_PRESETS) {
      expect(footage.type).toBe('video');
      expect(footage.targetTrackType).toBe('video');
      expect(footage.assetId).toBeTruthy();

      const seq = footage.createSequence({ startFrame: 30 });
      expect(seq.type).toBe('video');
      expect(seq.assetId).toBe(footage.assetId);
    }
  });

  it('validates all AUDIO_PRESETS use registered audio/volume modifier instead of audio/gain', () => {
    expect(AUDIO_PRESETS.length).toBeGreaterThan(0);

    for (const audio of AUDIO_PRESETS) {
      expect(audio.type).toBe('audio');
      expect(audio.targetTrackType).toBe('audio');

      const seq = audio.createSequence({ startFrame: 0 });
      expect(seq.type).toBe('audio');

      if (seq.modifiers) {
        for (const mod of seq.modifiers) {
          expect(mod.type).not.toBe('audio/gain');
          if (mod.type === 'audio/volume') {
            expect(typeof mod.params?.volume).toBe('number');
          }
        }
      }
    }
  });

  it('ShapeModifierPlugin renders arrow and rounded_rect geometry without throwing', () => {
    const plugin = new ShapeModifierPlugin();

    const mockCtx = {
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => {},
      arcTo: () => {},
      closePath: () => {},
      fill: () => {},
      stroke: () => {},
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: '',
      lineJoin: '',
      globalAlpha: 1,
    } as any;

    const clipCtx = {
      canvas: {} as any,
      ctx: mockCtx,
      frame: 10,
      localFrame: 10,
      width: 1920,
      height: 1080,
      sequence: { id: 's1', type: 'overlay', time: { start: 0, duration: 60 } } as any,
    };

    // Verify arrow rendering
    expect(() => {
      plugin.renderClipSpace(clipCtx, {
        geometry: 'arrow',
        fillColor: '#38bdf8',
        strokeColor: '#0284c7',
        strokeWidth: 4,
      });
    }).not.toThrow();

    // Verify rounded_rect rendering with cornerRadius
    expect(() => {
      plugin.renderClipSpace(clipCtx, {
        geometry: 'rounded_rect',
        cornerRadius: 16,
        fillColor: '#38bdf8',
      });
    }).not.toThrow();
  });

  it('PartialVFXPlugin normalizes legacy flat parameters into structured regions', () => {
    const plugin = new PartialVFXPlugin();

    const mockCtx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      arc: () => {},
      rect: () => {},
      clip: () => {},
      filter: '',
      drawImage: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(100), width: 10, height: 10 }),
      putImageData: () => {},
    } as any;

    const clipCtx = {
      canvas: {} as any,
      ctx: mockCtx,
      frame: 0,
      localFrame: 0,
      width: 1920,
      height: 1080,
      sequence: { id: 's-vfx', type: 'video', time: { start: 0, duration: 60 } } as any,
    };

    // Calling with flat parameters normX, normY, radius should not throw
    expect(() => {
      plugin.renderClipSpace(clipCtx, {
        effectType: 'blur',
        normX: 0.5,
        normY: 0.5,
        radius: 150,
        intensity: 0.8,
      } as any);
    }).not.toThrow();
  });
});
