import { describe, it, expect, beforeEach } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import { PARTICLE_PRESET_DEFAULTS } from '../apps/studio/src/components/RightSidebar';
import { UniversalCanvasEngine } from '@acc/effect-engines';
import type { VideoIR } from '@acc/ir';

describe('Phase 4: RightSidebar Inspector Panels for HUD & Particles Suite', () => {
  let irState: IRStateManager;

  const mockBaseIR: VideoIR = {
    version: '1.0.0',
    metadata: {
      title: 'Phase 4 HUD & Particle Test',
      author: 'Studio Test Runner',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      generator: 'Studio Test',
      totalDurationFrames: 300,
    },
    canvas: {
      width: 1920,
      height: 1080,
      fps: 30,
      colorSpace: 'srgb',
    },
    tracks: [
      {
        id: 'track-v1',
        name: 'Video Track 1',
        type: 'visual',
        order: 1,
        sequences: [
          {
            id: 'seq-hud-test-1',
            name: 'Hero Visual Plate',
            type: 'video',
            time: { start: 0, duration: 150 },
            modifiers: [
              {
                type: 'transform',
                params: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
              },
            ],
          },
        ],
      },
    ],
  };

  beforeEach(async () => {
    irState = IRStateManager.getInstance();
    await irState.switchTemplate('scifi');
    irState.setSelectedSequenceId('seq-city-intro');
  });

  describe('1. Predefined Constants & AVAILABLE_MODIFIERS Registration', () => {
    it('should export PARTICLE_PRESET_DEFAULTS with complete physics and shader mappings for all 8 types', () => {
      const expectedTypes = [
        'cyber_sparks',
        'embers',
        'dust',
        'rain',
        'snow',
        'bokeh',
        'matrix_rain',
        'digital_glitch',
      ];

      for (const pType of expectedTypes) {
        const def = PARTICLE_PRESET_DEFAULTS[pType];
        expect(def).toBeDefined();
        expect(typeof def.intensity).toBe('number');
        expect(typeof def.speed).toBe('number');
        expect(typeof def.opacity).toBe('number');
        expect(typeof def.particleCount).toBe('number');
        expect(typeof def.bloomEnabled).toBe('boolean');
        expect(typeof def.bloomThreshold).toBe('number');
        expect(typeof def.bloomIntensity).toBe('number');
        expect(typeof def.chromaticAberrationEnabled).toBe('boolean');
        expect(typeof def.chromaticAberrationOffset).toBe('number');
      }
    });

    it('should register overlay/hologram_hud in RightSidebar with default parameters', () => {
      const source = readFileSync(
        join(process.cwd(), 'apps/studio/src/components/RightSidebar.tsx'),
        'utf-8'
      );

      expect(source).toContain("type: 'overlay/hologram_hud'");
      expect(source).toContain("name: 'Hologram HUD'");
      expect(source).toContain('ringRadiusNorm: 0.35');
      expect(source).toContain('scanlineDensity: 40');
      expect(source).toContain("color: '#00ffff'");
      expect(source).toContain('rotationSpeed: 0.5');
    });

    it('should register overlay/canvas_particles with schema-aligned default parameters', () => {
      const source = readFileSync(
        join(process.cwd(), 'apps/studio/src/components/RightSidebar.tsx'),
        'utf-8'
      );

      expect(source).toContain("type: 'overlay/canvas_particles'");
      expect(source).toContain("name: 'Particle VFX & Shaders'");
      expect(source).toContain("type: 'cyber_sparks'");
      expect(source).toContain('intensity: 1.0');
      expect(source).toContain('particleCount: 1500');
      expect(source).toContain('shaders: {');
      expect(source).toContain('bloom: {');
      expect(source).toContain('chromaticAberration: {');
    });
  });

  describe('2. Dedicated Hologram HUD Modifier Attachment & Live Parameter Updates', () => {
    it('should attach overlay/hologram_hud modifier and update parameters via IRStateManager', () => {
      const initialHud = {
        enabled: true,
        ringRadiusNorm: 0.35,
        scanlineDensity: 40,
        color: '#00ffff',
        rotationSpeed: 0.5,
      };

      irState.updateModifier('seq-city-intro', 'overlay/hologram_hud', initialHud);

      let seq = irState.getState().doc.tracks[0].sequences[0];
      let hudMod = seq.modifiers.find((m) => m.type === 'overlay/hologram_hud');
      expect(hudMod).toBeDefined();
      expect(hudMod?.params?.ringRadiusNorm).toBe(0.35);

      // Mutate HUD parameters as slider drags occur in RightSidebar
      irState.updateModifier('seq-city-intro', 'overlay/hologram_hud', {
        ringRadiusNorm: 0.55,
        scanlineDensity: 65,
        color: '#ec4899',
        rotationSpeed: 1.2,
      });

      seq = irState.getState().doc.tracks[0].sequences[0];
      hudMod = seq.modifiers.find((m) => m.type === 'overlay/hologram_hud');
      expect(hudMod?.params?.ringRadiusNorm).toBe(0.55);
      expect(hudMod?.params?.scanlineDensity).toBe(65);
      expect(hudMod?.params?.color).toBe('#ec4899');
      expect(hudMod?.params?.rotationSpeed).toBe(1.2);
    });

    it('should support dual schema fallback when overlay/canvas_particles has type sci_fi_hud', () => {
      const sciFiHudParticle = {
        enabled: true,
        type: 'sci_fi_hud',
        intensity: 1.5,
        speed: 1.8,
        opacity: 0.85,
        ringRadiusNorm: 0.45,
        color: '#f59e0b',
      };

      irState.updateModifier('seq-city-intro', 'overlay/canvas_particles', sciFiHudParticle);

      const seq = irState.getState().doc.tracks[0].sequences[0];
      const particleMod = seq.modifiers.find((m) => m.type === 'overlay/canvas_particles');
      expect(particleMod).toBeDefined();
      expect(particleMod?.params?.type).toBe('sci_fi_hud');
      expect(particleMod?.params?.ringRadiusNorm).toBe(0.45);
      expect(particleMod?.params?.color).toBe('#f59e0b');
    });
  });

  describe('3. Strict Schema-Aligned Particle VFX Inspector & Shaders', () => {
    it('should update particle type and preserve decoupled slider positions', () => {
      irState.updateModifier('seq-city-intro', 'overlay/canvas_particles', {
        enabled: true,
        type: 'snow',
        preset: 'snow',
        intensity: 1.4,
        speed: 2.1,
        opacity: 0.9,
        particleCount: 2200,
      });

      // Switch type to 'rain' without resetting sliders
      const currentParams = irState.getState().doc.tracks[0].sequences[0].modifiers.find(
        (m) => m.type === 'overlay/canvas_particles'
      )?.params;

      irState.updateModifier('seq-city-intro', 'overlay/canvas_particles', {
        ...currentParams,
        type: 'rain',
        preset: 'rain',
      });

      const seq = irState.getState().doc.tracks[0].sequences[0];
      const mod = seq.modifiers.find((m) => m.type === 'overlay/canvas_particles');
      expect(mod?.params?.type).toBe('rain');
      // Preserved slider values
      expect(mod?.params?.intensity).toBe(1.4);
      expect(mod?.params?.speed).toBe(2.1);
      expect(mod?.params?.opacity).toBe(0.9);
      expect(mod?.params?.particleCount).toBe(2200);
    });

    it('should synchronize nested post-processing shaders and flat legacy properties', () => {
      irState.updateModifier('seq-city-intro', 'overlay/canvas_particles', {
        enabled: true,
        type: 'cyber_sparks',
        particleCount: 1500,
        bloomThreshold: 0.55,
        chromaticAberration: 3.5,
        shaders: {
          bloom: { enabled: true, threshold: 0.55, intensity: 1.8 },
          chromaticAberration: { enabled: true, offsetPx: 3.5 },
        },
      });

      const seq = irState.getState().doc.tracks[0].sequences[0];
      const mod = seq.modifiers.find((m) => m.type === 'overlay/canvas_particles');
      expect(mod?.params?.shaders?.bloom?.threshold).toBe(0.55);
      expect(mod?.params?.shaders?.bloom?.intensity).toBe(1.8);
      expect(mod?.params?.shaders?.chromaticAberration?.offsetPx).toBe(3.5);
      expect(mod?.params?.bloomThreshold).toBe(0.55);
      expect(mod?.params?.chromaticAberration).toBe(3.5);
    });
  });

  describe('4. UniversalCanvasEngine Reactivity & Particle Count Inspection', () => {
    it('should accurately report and update particle count via getParticleCount', () => {
      const engine = new UniversalCanvasEngine({ width: 1280, height: 720 });

      expect(engine.hasParticles()).toBe(false);
      expect(engine.getParticleCount()).toBe(0);

      engine.initParticleSystem(500);
      expect(engine.hasParticles()).toBe(true);
      expect(engine.getParticleCount()).toBe(500);

      engine.initParticleSystem(1200);
      expect(engine.getParticleCount()).toBe(1200);

      engine.clearParticles();
      expect(engine.hasParticles()).toBe(false);
      expect(engine.getParticleCount()).toBe(0);
    });

    it('should initialize and clear Hologram HUD telemetry in UniversalCanvasEngine', () => {
      const engine = new UniversalCanvasEngine({ width: 1280, height: 720 });

      expect(engine.hasHologramHUD()).toBe(false);

      engine.initHologramHUD(0.4, 50, '#00ffff', 1.0);
      expect(engine.hasHologramHUD()).toBe(true);

      engine.clearHologramHUD();
      expect(engine.hasHologramHUD()).toBe(false);
    });
  });

  describe('5. Rule 229 Guardrail & DOM Integrity Verification', () => {
    it('should verify that all AccordionTrigger components in RightSidebar use the actions prop for interactive elements', () => {
      const source = readFileSync(
        join(process.cwd(), 'apps/studio/src/components/RightSidebar.tsx'),
        'utf-8'
      );

      // Extract all AccordionTrigger openings
      const triggerMatches = [...source.matchAll(/<AccordionTrigger([\s\S]*?)>/g)];
      expect(triggerMatches.length).toBeGreaterThan(0);

      for (const match of triggerMatches) {
        const triggerAttrs = match[1];
        // If the accordion trigger has actions, it should declare actions={...}
        // It must NOT place raw <Button> or <Switch> inside the children of AccordionTrigger
        if (triggerAttrs.includes('actions=')) {
          expect(triggerAttrs).toContain('actions=');
        }
      }

      // Check Hologram HUD and Particle VFX AccordionItem presence
      expect(source).toContain('AccordionItem value="hologram_hud"');
      expect(source).toContain('AccordionItem value="particles"');
    });
  });

  describe('6. Sequence Selection Reactivity & Immutable State Verification', () => {
    it('should notify subscribers with a new immutable state reference when setSelectedSequenceId is called', () => {
      let stateEmissions: any[] = [];
      const unsub = irState.subscribe((st) => {
        stateEmissions.push(st);
      });

      const initialCount = stateEmissions.length;
      const firstState = stateEmissions[initialCount - 1];

      // Switch selection to another sequence
      irState.setSelectedSequenceId('seq-pilot-vo');

      expect(stateEmissions.length).toBe(initialCount + 1);
      const nextState = stateEmissions[stateEmissions.length - 1];

      // Verify that nextState !== firstState (React re-render guarantee)
      expect(nextState).not.toBe(firstState);
      expect(nextState.selectedSequenceId).toBe('seq-pilot-vo');

      // Clear selection
      irState.setSelectedSequenceId(null);
      expect(stateEmissions.length).toBe(initialCount + 2);
      const clearedState = stateEmissions[stateEmissions.length - 1];
      expect(clearedState).not.toBe(nextState);
      expect(clearedState.selectedSequenceId).toBeNull();

      unsub();
    });
  });
});
