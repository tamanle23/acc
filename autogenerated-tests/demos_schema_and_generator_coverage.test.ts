import { describe, it, expect } from 'bun:test';
import { VideoIRSchemaValidator } from '../packages/ir/src/schema/VideoIRSchemaValidator';
import { ModifierPluginRegistry } from '../packages/ir/src/plugins/ModifierPluginRegistry';
import { complexSciFiDemoIR } from '../apps/studio/src/lib/ir/complexSciFiDemoIR';
import { defaultDemoIR } from '../apps/studio/src/lib/ir/defaultDemoIR';
import { broadcastNewsDemoIR } from '../apps/studio/src/lib/ir/broadcastNewsDemoIR';
import { cyberAudioVisualizerDemoIR } from '../apps/studio/src/lib/ir/cyberAudioVisualizerDemoIR';
import { quantumPhysicsDemoIR } from '../apps/studio/src/lib/ir/quantumPhysicsDemoIR';
import { astroTelemetryDemoIR } from '../apps/studio/src/lib/ir/astroTelemetryDemoIR';
import { kineticTypographyDemoIR } from '../apps/studio/src/lib/ir/kineticTypographyDemoIR';
import { cinemaMasteringDemoIR } from '../apps/studio/src/lib/ir/cinemaMasteringDemoIR';
import { spatialAudioDemoIR } from '../apps/studio/src/lib/ir/spatialAudioDemoIR';

describe('Demo Showcase Multi-Track Validation & Single-Source Generator Invariant Verification', () => {
  const registry = ModifierPluginRegistry.getInstance();

  const demos = [
    { name: 'complexSciFiDemoIR', doc: complexSciFiDemoIR },
    { name: 'defaultDemoIR', doc: defaultDemoIR },
    { name: 'broadcastNewsDemoIR', doc: broadcastNewsDemoIR },
    { name: 'cyberAudioVisualizerDemoIR', doc: cyberAudioVisualizerDemoIR },
    { name: 'quantumPhysicsDemoIR', doc: quantumPhysicsDemoIR },
    { name: 'astroTelemetryDemoIR', doc: astroTelemetryDemoIR },
    { name: 'kineticTypographyDemoIR', doc: kineticTypographyDemoIR },
    { name: 'cinemaMasteringDemoIR', doc: cinemaMasteringDemoIR },
    { name: 'spatialAudioDemoIR', doc: spatialAudioDemoIR },
  ];

  it('validates that ALL 9 studio demo projects strictly pass VideoIRSchemaValidator with zero errors', () => {
    for (const { name, doc } of demos) {
      const result = VideoIRSchemaValidator.validate(doc);
      if (!result.valid) {
        console.error(`[Test Failure] ${name} validation errors:`, result.errors);
      }
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    }
  });

  it('verifies that no sequence across any of the 9 demos hosts multiple standalone generators', () => {
    for (const { name, doc } of demos) {
      for (const track of doc.tracks) {
        for (const seq of track.sequences) {
          const standaloneCount = (seq.modifiers || []).filter(
            (m) => registry.get(m.type)?.targetScope === 'standalone'
          ).length;
          expect(standaloneCount).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('verifies that standalone generator sequences only host universal modifiers', () => {
    for (const { name, doc } of demos) {
      for (const track of doc.tracks) {
        for (const seq of track.sequences) {
          const hasStandalone = (seq.modifiers || []).some(
            (m) => registry.get(m.type)?.targetScope === 'standalone'
          );
          if (hasStandalone) {
            for (const mod of seq.modifiers || []) {
              const plugin = registry.get(mod.type);
              if (plugin && plugin.targetScope !== 'standalone') {
                const isUniversal = Boolean(plugin.isUniversal);
                expect(isUniversal).toBe(true);
              }
            }
          }
        }
      }
    }
  });

  it('covers all major modifier categories across the 9 demos', () => {
    const allModTypes = new Set<string>();
    for (const { doc } of demos) {
      for (const mod of doc.modifiers || []) {
        allModTypes.add(mod.type);
      }
      for (const track of doc.tracks) {
        for (const mod of track.modifiers || []) {
          allModTypes.add(mod.type);
        }
        for (const seq of track.sequences) {
          for (const mod of seq.modifiers || []) {
            allModTypes.add(mod.type);
          }
        }
      }
    }

    // Timeline Scope
    expect(allModTypes.has('timeline/photometric_bloom')).toBe(true);
    expect(allModTypes.has('timeline/anamorphic_glare')).toBe(true);

    // Track Scope
    expect(allModTypes.has('timed_text/style')).toBe(true);

    // Sequence VFX & Spatial
    expect(allModTypes.has('vfx/color_grading')).toBe(true);
    expect(allModTypes.has('vfx/depth3d')).toBe(true);
    expect(allModTypes.has('vfx/partial')).toBe(true);
    expect(allModTypes.has('transform')).toBe(true);
    expect(allModTypes.has('transition/crossfade')).toBe(true);

    // Audio SFX & DSP
    expect(allModTypes.has('audio/volume')).toBe(true);
    expect(allModTypes.has('audio/pan')).toBe(true);
    expect(allModTypes.has('audio/filter')).toBe(true);
    expect(allModTypes.has('audio/pitch')).toBe(true);
    expect(allModTypes.has('sfx/dynamic_ducking')).toBe(true);

    // Standalone Overlay & TimeSpace Generators
    expect(allModTypes.has('overlay/canvas_particles')).toBe(true);
    expect(allModTypes.has('overlay/hologram_hud')).toBe(true);
    expect(allModTypes.has('time_space/callout_leader')).toBe(true);
    expect(allModTypes.has('time_space/callout_multitarget')).toBe(true);
    expect(allModTypes.has('time_space/hud_reticle')).toBe(true);
    expect(allModTypes.has('time_space/cyber_lower_third')).toBe(true);
    expect(allModTypes.has('time_space/countdown')).toBe(true);
    expect(allModTypes.has('time_space/energy_shield')).toBe(true);
    expect(allModTypes.has('time_space/audio_waveform')).toBe(true);
    expect(allModTypes.has('time_space/audio_spectrum')).toBe(true);
    expect(allModTypes.has('time_space/cymatic_chladni')).toBe(true);
    expect(allModTypes.has('time_space/strange_attractor')).toBe(true);
    expect(allModTypes.has('time_space/relativistic_blackhole')).toBe(true);
    expect(allModTypes.has('time_space/topographic_contour')).toBe(true);
    expect(allModTypes.has('time_space/hyperbolic_poincare')).toBe(true);
    expect(allModTypes.has('time_space/kinetic_harmonograph')).toBe(true);
    expect(allModTypes.has('time_space/kinetic_title')).toBe(true);
    expect(allModTypes.has('time_space/network_plexus')).toBe(true);
    expect(allModTypes.has('time_space/glitch_datastream')).toBe(true);
    expect(allModTypes.has('time_space/superformula')).toBe(true);
  });
});
