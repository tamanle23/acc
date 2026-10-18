import { describe, it, expect, beforeEach } from 'bun:test';
import { UniversalAudioMixer } from '@acc/effect-engines/client';
import { IRPreviewEngine } from '@acc/ir/client';
import { PartialVFXPlugin } from '../packages/ir/src/plugins/vfx/PartialVFXPlugin';
import { HologramHUDPlugin } from '../packages/ir/src/plugins/overlay/HologramHUDPlugin';
import { WebAudioEngine } from '../apps/studio/src/lib/audio/WebAudioEngine';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';

describe('Studio IRPreviewEngine & UniversalAudioMixer Deep Wiring', () => {
  let manager: IRStateManager;

  beforeEach(async () => {
    manager = IRStateManager.getInstance();
    await manager.switchTemplate('scifi');
  });

  describe('IRPreviewEngine & Partial VFX Subsystems', () => {
    it('should initialize IRPreviewEngine and render partial VFX deterministically', () => {
      const state = manager.getState();
      const engine = new IRPreviewEngine(state.timeline);
      expect(engine).toBeDefined();

      const vfxPlugin = new PartialVFXPlugin();
      expect(vfxPlugin.type).toBe('vfx/partial');

      const hudPlugin = new HologramHUDPlugin();
      expect(hudPlugin.type).toBe('overlay/hologram_hud');
    });
  });

  describe('UniversalAudioMixer & WebAudioEngine Dynamic Ducking Modifier Sync', () => {
    it('should dynamically read sfx/dynamic_ducking modifier from VideoIR and apply duckingFactor', async () => {
      const engine = WebAudioEngine.getInstance();

      // Update dynamic ducking modifier on pilot comm sequence with custom duckVolume
      manager.updateModifier('seq-pilot-comm', 'sfx/dynamic_ducking', {
        duckVolume: 0.15,
        attackMs: 120,
        releaseMs: 250,
        stereoPan: -0.2,
      });
      await manager.recompile();

      const updatedState = manager.getState();
      engine.syncFromIR(updatedState, 30);

      // Test synthesis via UniversalAudioMixer
      const mixer = (engine as any).mixer as UniversalAudioMixer;
      expect(mixer).toBeDefined();
      expect(mixer.duckingFactor).toBe(0.15);

      const mixResult = mixer.mixStereo(0.0, 1.0);
      expect(mixResult.left).toBeInstanceOf(Float32Array);
      expect(mixResult.right).toBeInstanceOf(Float32Array);
      expect(mixResult.left.length).toBe(44100);
      expect(mixResult.peakDb).toBeGreaterThan(-60);
    });

    it('should fallback to 0.25 duckingFactor when dynamic ducking modifier is absent', async () => {
      const engine = WebAudioEngine.getInstance();
      // Remove modifier
      manager.removeModifier('seq-pilot-comm', 'sfx/dynamic_ducking');
      await manager.recompile();

      const updatedState = manager.getState();
      engine.syncFromIR(updatedState, 30);

      const mixer = (engine as any).mixer as UniversalAudioMixer;
      expect(mixer.duckingFactor).toBe(0.25);
    });
  });
});
