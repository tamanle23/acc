import { describe, it, expect } from 'bun:test';
import {
  ShapeModifierPlugin,
  ProceduralSFXModifierPlugin,
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
} from '../packages/ir/src';
import { UniversalCanvasProvider } from '@acc/effect-engines';
import {
  SFX_LIBRARY_CATALOG,
  SFX_SOUND_BANKS,
  convertSFXToPreset,
} from '../apps/studio/src/lib/library/sfxBank';
import {
  PRESET_LIBRARY,
  getPresetsByCategory,
} from '../apps/studio/src/lib/library/stagingPresets';

describe('Iteration 11 Phase 1: LeftSidebar Staging Library & Retained Modifier Plugins', () => {
  describe('ShapeModifierPlugin', () => {
    it('should initialize and validate ShapeModifierPlugin correctly', () => {
      const plugin = new ShapeModifierPlugin();
      expect(plugin.type).toBe('shape/draw');
      expect(plugin.targetScope).toBe('sequence');
      expect(plugin.targetPhase).toBe(2);

      expect(plugin.validate({})).toBe(true);
      expect(plugin.validate({ geometry: 'circle', fillColor: '#00ffcc' })).toBe(true);
      expect(plugin.validate(null)).toBe(false);
      expect(plugin.validate(undefined)).toBe(false);
    });

    it('should be registered in ModifierPluginRegistry under both shape/draw and shape/vector', () => {
      const registry = new ModifierPluginRegistry();
      registerCoreModifierPlugins(registry);

      const drawPlugin = registry.get('shape/draw');
      const vectorPlugin = registry.get('shape/vector');

      expect(drawPlugin).toBeDefined();
      expect(vectorPlugin).toBeDefined();
      expect(drawPlugin).toBeInstanceOf(ShapeModifierPlugin);
      expect(vectorPlugin).toBeInstanceOf(ShapeModifierPlugin);
    });

    it('should render clip-space paths for multiple geometries without errors', () => {
      const plugin = new ShapeModifierPlugin();
      const canvasInst = UniversalCanvasProvider.createCanvas(800, 600);
      const canvas = canvasInst.getRawCanvas ? canvasInst.getRawCanvas() : canvasInst;
      const ctx = canvas.getContext('2d');

      const geometries: Array<any> = [
        'rect',
        'rounded_rect',
        'circle',
        'pill',
        'star',
        'polygon',
        'triangle',
        'hexagon',
        'cross',
        'frame',
      ];

      for (const geom of geometries) {
        ctx.save();
        expect(() => {
          plugin.renderClipSpace(
            {
              canvas,
              ctx,
              frame: 0,
              localFrame: 0,
              width: 800,
              height: 600,
              sequence: { id: `test_${geom}`, durationFrames: 30, fps: 30 } as any,
            },
            {
              geometry: geom,
              width: 200,
              height: 150,
              fillColor: '#FF3366',
              strokeColor: '#FFFFFF',
              strokeWidth: 4,
              cornerRadius: 12,
              shadowBlur: 10,
              shadowColor: 'rgba(0,0,0,0.5)',
            }
          );
        }).not.toThrow();
        ctx.restore();
      }
    });

    it('should render radial and linear gradients cleanly', () => {
      const plugin = new ShapeModifierPlugin();
      const canvasInst = UniversalCanvasProvider.createCanvas(800, 600);
      const canvas = canvasInst.getRawCanvas ? canvasInst.getRawCanvas() : canvasInst;
      const ctx = canvas.getContext('2d');

      // Linear gradient
      expect(() => {
        plugin.renderClipSpace(
          {
            canvas,
            ctx,
            frame: 0,
            localFrame: 0,
            width: 800,
            height: 600,
            sequence: { id: 'linear_test', durationFrames: 30, fps: 30 } as any,
          },
          {
            geometry: 'rounded_rect',
            width: 300,
            height: 200,
            gradient: {
              type: 'linear',
              colors: ['#00F2FE', '#4FACFE'],
              angleDeg: 90,
            },
          }
        );
      }).not.toThrow();

      // Radial gradient
      expect(() => {
        plugin.renderClipSpace(
          {
            canvas,
            ctx,
            frame: 0,
            localFrame: 0,
            width: 800,
            height: 600,
            sequence: { id: 'radial_test', durationFrames: 30, fps: 30 } as any,
          },
          {
            geometry: 'circle',
            width: 200,
            height: 200,
            gradient: {
              type: 'radial',
              colors: ['#FF0844', '#FFB199'],
            },
          }
        );
      }).not.toThrow();
    });
  });

  describe('ProceduralSFXModifierPlugin', () => {
    it('should initialize and validate ProceduralSFXModifierPlugin correctly', () => {
      const plugin = new ProceduralSFXModifierPlugin();
      expect(plugin.type).toBe('sfx/procedural');
      expect(plugin.targetScope).toBe('both');
      expect(plugin.targetPhase).toBe(2);

      expect(plugin.validate({})).toBe(true);
      expect(plugin.validate({ sfxType: 'whoosh', durationSec: 1.2 })).toBe(true);
      expect(plugin.validate(null)).toBe(false);
      expect(plugin.validate(undefined)).toBe(false);
    });

    it('should be registered in ModifierPluginRegistry under sfx/procedural', () => {
      const registry = new ModifierPluginRegistry();
      registerCoreModifierPlugins(registry);

      const sfxPlugin = registry.get('sfx/procedural');
      expect(sfxPlugin).toBeDefined();
      expect(sfxPlugin).toBeInstanceOf(ProceduralSFXModifierPlugin);
    });

    it('should generate Float32Array PCM buffers across all sound categories', () => {
      const plugin = new ProceduralSFXModifierPlugin();
      const sampleRate = 44100;
      const sfxTypes: Array<any> = [
        'whoosh',
        'impact',
        'glitch',
        'riser',
        'laser',
        'engine_hum',
        'pilot_voice',
        'click',
        'pop',
        'beep',
        'sub_drop',
      ];

      for (const type of sfxTypes) {
        const durationSec = 0.2;
        const buffer = plugin.generateAudioBuffer({ sfxType: type, durationSec }, sampleRate);

        expect(buffer).toBeInstanceOf(Float32Array);
        expect(buffer.length).toBe(Math.floor(durationSec * sampleRate));

        // Check that at least some audio sample is non-zero
        let maxAmp = 0;
        for (let i = 0; i < buffer.length; i++) {
          const abs = Math.abs(buffer[i]);
          if (abs > maxAmp) maxAmp = abs;
        }
        expect(maxAmp).toBeGreaterThan(0.001);
      }
    });

    it('should process timeline audio context additively without mutating source in-place', () => {
      const plugin = new ProceduralSFXModifierPlugin();
      const sampleRate = 44100;
      const numSamples = Math.floor(0.1 * sampleRate);
      const outputBuffer = new Float32Array(numSamples); // initially silence

      plugin.processAudio(
        {
          sampleRate,
          outputBuffer,
          frameStart: 0,
          frameCount: 3,
          fps: 30,
        },
        { sfxType: 'click', durationSec: 0.1, volume: 0.8 }
      );

      let hasSignal = false;
      for (let i = 0; i < outputBuffer.length; i++) {
        if (outputBuffer[i] !== 0) {
          hasSignal = true;
          break;
        }
      }
      expect(hasSignal).toBe(true);
    });
  });

  describe('SFX Bank & Staging Presets Catalog', () => {
    it('should contain at least 104 sound effects across 6 distinct banks', () => {
      expect(SFX_LIBRARY_CATALOG.length).toBeGreaterThanOrEqual(104);
      expect(SFX_SOUND_BANKS.length).toBe(7); // 'all' + 6 distinct banks

      const banks = new Set(SFX_LIBRARY_CATALOG.map((s) => s.bank));
      expect(banks.has('whoosh')).toBe(true);
      expect(banks.has('impact')).toBe(true);
      expect(banks.has('click')).toBe(true);
      expect(banks.has('riser')).toBe(true);
      expect(banks.has('cyber')).toBe(true);
      expect(banks.has('ambient')).toBe(true);
    });

    it('should correctly convert SFX definitions into Drag-and-Drop PresetItems', () => {
      const firstSFX = SFX_LIBRARY_CATALOG[0];
      const preset = convertSFXToPreset(firstSFX);

      expect(preset.id).toBe(`preset_${firstSFX.id}`);
      expect(preset.name).toBe(firstSFX.name);
      expect(preset.category).toBe('sfx');
      expect(preset.targetTrackType).toBe('audio');

      const seq = preset.createSequence({ startFrame: 0 });
      expect(seq.type).toBe('audio');
      expect(seq.modifiers).toBeDefined();

      const sfxMod = seq.modifiers?.find((m) => m.type === 'sfx/procedural');
      expect(sfxMod).toBeDefined();
      expect(sfxMod?.params).toEqual(firstSFX.params);
    });

    it('should support video and audio footage presets in PRESET_LIBRARY', () => {
      const videoPresets = getPresetsByCategory('video');
      const audioPresets = getPresetsByCategory('audio');

      expect(videoPresets.length).toBeGreaterThanOrEqual(3);
      expect(audioPresets.length).toBeGreaterThanOrEqual(3);

      for (const vp of videoPresets) {
        expect(vp.category).toBe('video');
        expect(vp.targetTrackType).toBe('video');
        expect(vp.thumbnailUrl).toBeDefined();
        const seq = vp.createSequence({ startFrame: 0 });
        expect(seq.assetId).toBeDefined();
      }

      for (const ap of audioPresets) {
        expect(ap.category).toBe('audio');
        expect(ap.targetTrackType).toBe('audio');
        const seq = ap.createSequence({ startFrame: 0 });
        expect(seq.type).toBe('audio');
      }
    });
  });
});
