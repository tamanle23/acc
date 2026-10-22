import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';
import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
  createIsolatedCoreModifierPlugins,
  GSAPMotionPlugin,
  DepthRelightingAdapterPlugin,
  Depth3DPlugin,
  Camera3DPlugin,
  CanvasParticleOverlayPlugin,
  CaptionModifierPlugin,
  ProceduralSFXModifierPlugin,
  evaluateGSAPEasing,
  GSAP_EASING_PRESETS,
  type VideoIRModifier,
} from '@acc/ir';

describe('Studio Inspector & Modifier Plugin Parity Suite', () => {
  describe('1. RightSidebar Architectural Decomposition', () => {
    it('verifies RightSidebar.tsx has been decomposed to less than 350 lines', () => {
      const rightSidebarPath = path.resolve(
        __dirname,
        '../apps/studio/src/components/RightSidebar.tsx'
      );
      const content = fs.readFileSync(rightSidebarPath, 'utf-8');
      const lines = content.split('\n').length;
      expect(lines).toBeLessThan(350);
    });

    it('verifies sub-inspectors exist and are modularized', () => {
      const inspectorDir = path.resolve(
        __dirname,
        '../apps/studio/src/components/inspector'
      );
      expect(fs.existsSync(path.join(inspectorDir, 'ProjectInspector.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(inspectorDir, 'TrackInspector.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(inspectorDir, 'SequenceInspector.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(inspectorDir, 'DynamicModifierInspector.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(inspectorDir, 'ModifierControlStrategies.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(inspectorDir, 'modifierCatalog.ts'))).toBe(true);
      expect(fs.existsSync(path.join(inspectorDir, 'ParameterControls.tsx'))).toBe(true);
    });
  });

  describe('2. Motion/GSAP Plugin & Deterministic Easing Math', () => {
    it('registers motion/gsap and evaluates deterministic easing curves', () => {
      const registry = createIsolatedCoreModifierPlugins();
      expect(registry.has('motion/gsap')).toBe(true);
      // Canonical IR registry refactor: legacy animation/gsap alias is eliminated
      expect(registry.has('animation/gsap')).toBe(false);

      const plugin = registry.get('motion/gsap');
      expect(plugin).toBeDefined();
      expect(plugin?.targetScope).toBe('both');

      // Test easing curve evaluations
      expect(evaluateGSAPEasing('linear', 0.5)).toBeCloseTo(0.5, 3);
      expect(evaluateGSAPEasing('power2.out', 0.5)).toBeGreaterThan(0.5);
      expect(evaluateGSAPEasing('bounce.out', 1.0)).toBeCloseTo(1.0, 3);
      expect(evaluateGSAPEasing('elastic.out', 1.0)).toBeCloseTo(1.0, 3);
      expect(evaluateGSAPEasing('back.out', 0.7)).toBeGreaterThan(0.7);
      expect(evaluateGSAPEasing('expo.out', 0.5)).toBeGreaterThan(0.9);

      // Verify all 7 presets exist in GSAP_EASING_PRESETS
      const presetIds = GSAP_EASING_PRESETS.map((p) => p.id);
      expect(presetIds).toContain('linear');
      expect(presetIds).toContain('power2.out');
      expect(presetIds).toContain('power2.inOut');
      expect(presetIds).toContain('back.out');
      expect(presetIds).toContain('elastic.out');
      expect(presetIds).toContain('bounce.out');
      expect(presetIds).toContain('expo.out');
    });

    it('interpolates transforms deterministically across a sequence duration', () => {
      const plugin = new GSAPMotionPlugin();
      const modifier: VideoIRModifier = {
        type: 'motion/gsap',
        params: {
          preset: 'pop_in',
          ease: 'elastic.out',
          introDurationSec: 0.5,
          outroDurationSec: 0.3,
        },
      };

      const result = plugin.evaluateTransformAtTime(modifier, 0.25, 2.0);
      expect(result.scale).toBeDefined();
      expect(result.opacity).toBeDefined();
      expect(result.opacity).toBeGreaterThanOrEqual(0);
      expect(result.opacity).toBeLessThanOrEqual(1.0);
    });
  });

  describe('3. Pristine Depth3DPlugin & DepthRelightingAdapterPlugin', () => {
    it('unrolls flat UI parameters into nested relighting object without mutating Depth3DPlugin', () => {
      const baseDepth = new Depth3DPlugin();
      const adapter = new DepthRelightingAdapterPlugin(baseDepth);

      expect(adapter.type).toBe('vfx/depth_relighting');

      // Verify schema exposes flat slider keys
      const schema = adapter.schema;
      expect(schema.fields.lightColor).toBeDefined();
      expect(schema.fields.lightX).toBeDefined();
      expect(schema.fields.lightY).toBeDefined();
      expect(schema.fields.lightZ).toBeDefined();
      expect(schema.fields.diffuse).toBeDefined();
      expect(schema.fields.shininess).toBeDefined();
      expect(schema.fields.rimIntensity).toBeDefined();

      // Normalize parameters
      const normalized = adapter.normalizeParams({
        enabled: true,
        lightColor: '#ff00ff',
        lightX: 3.5,
        lightY: -1.2,
        lightZ: 8.0,
        diffuse: 1.5,
        shininess: 64,
        rimIntensity: 0.8,
      });

      expect(normalized.relighting).toBeDefined();
      expect(normalized.relighting.enabled).toBe(true);
      expect(normalized.relighting.lightColor).toBe('#ff00ff');
      expect(normalized.relighting.lightPosition).toEqual([3.5, -1.2, 8.0]);
      expect(normalized.relighting.diffuse).toBe(1.5);
      expect(normalized.relighting.shininess).toBe(64);
      expect(normalized.relighting.rimIntensity).toBe(0.8);

      // Verify Depth3DPlugin remains clean and independent
      expect(baseDepth.type).toBe('vfx/depth3d');
    });
  });

  describe('4. Modifier Parameter Parity (Camera3D, Particles, Text, SFX)', () => {
    it('Camera3DPlugin exposes and normalizes lens optical parameters', () => {
      const cam = new Camera3DPlugin();
      expect(cam.schema.fields.fov).toBeDefined();
      expect(cam.schema.fields.focalDistance).toBeDefined();
      expect(cam.schema.fields.bokehRadius).toBeDefined();
      expect(cam.schema.fields.roll).toBeDefined();

      const normalized = cam.normalizeParams({
        fov: 60,
        focalDistance: 3.2,
        bokehRadius: 8.0,
        roll: 15,
      });
      expect(normalized.fov).toBe(60);
      expect(normalized.focalDistance).toBe(3.2);
      expect(normalized.bokehRadius).toBe(8.0);
      expect(normalized.roll).toBe(15);
    });

    it('CanvasParticleOverlayPlugin exposes particleCount and nested shaders', () => {
      const particles = new CanvasParticleOverlayPlugin();
      expect(particles.schema.fields.particleCount).toBeDefined();
      expect(particles.schema.fields.shaders).toBeDefined();
      expect(particles.schema.fields.shaders.type).toBe('shader_group');
    });

    it('CaptionModifierPlugin exposes typography styling and karaoke highlight', () => {
      const caption = new CaptionModifierPlugin();
      expect(caption.schema.fields.fontFamily).toBeDefined();
      expect(caption.schema.fields.fontSize).toBeDefined();
      expect(caption.schema.fields.fillColor).toBeDefined();
      expect(caption.schema.fields.glowColor).toBeDefined();
      expect(caption.schema.fields.karaoke).toBeDefined();
      expect(caption.schema.fields.karaoke.type).toBe('karaoke_group');
    });

    it('ProceduralSFXModifierPlugin accepts synthType/sfxType and volume/gain with actions', () => {
      const sfx = new ProceduralSFXModifierPlugin();
      expect(sfx.schema.fields.synthType).toBeDefined();
      expect(sfx.schema.fields.durationSec).toBeDefined();
      expect(sfx.schema.fields.duckingFactor).toBeDefined();
      expect(sfx.schema.fields.actions).toBeDefined();
      expect(sfx.schema.fields.actions.type).toBe('sfx_actions');

      const norm1 = sfx.normalizeParams({ sfxType: 'riser', volume: 0.8 });
      expect(norm1.synthType).toBe('riser');
      expect(norm1.gain).toBe(0.8);

      const norm2 = sfx.normalizeParams({ synthType: 'whoosh', gain: 0.5 });
      expect(norm2.synthType).toBe('whoosh');
      expect(norm2.gain).toBe(0.5);
    });
  });
});
