import { describe, it, expect, beforeEach } from 'bun:test';
import { UniversalThreeScene, UniversalAudioMixer } from '@acc/effect-engines/client';
import { WebAudioEngine } from '../apps/studio/src/lib/audio/WebAudioEngine';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';

describe('Studio UniversalThreeScene & UniversalAudioMixer Deep Wiring', () => {
  let manager: IRStateManager;

  beforeEach(async () => {
    manager = IRStateManager.getInstance();
    await manager.switchTemplate('scifi');
  });

  describe('UniversalThreeScene Scenegraph & Partial VFX Subsystems', () => {
    it('should initialize 3D scenegraph with depth mesh, HUD hologram, and particle warp tunnel', () => {
      const scene3d = new UniversalThreeScene({
        width: 1920,
        height: 1080,
        fov: 45,
      });

      scene3d.initDepthMesh(32, 32, 8, 4.5);
      scene3d.initHologramHUD(6, 3.5);
      scene3d.initParticleSystem(200);

      expect(scene3d.scene.children.length).toBeGreaterThanOrEqual(4);
      expect(scene3d.overlay).toBeDefined();
      expect(scene3d.partialVfxGroup).toBeDefined();

      // Test partial VFX registration
      scene3d.setPartialVFXRegions([
        { id: 'spot-1', type: 'spotlight', x: 0.5, y: 0.5, radius: 150, color: '#00d4ff', intensity: 1.5 },
        { id: 'glitch-1', type: 'glitch', x: 0.3, y: 0.4, width: 0.3, height: 0.2, intensity: 1.0 },
        { id: 'emitter-1', type: 'point_emitter', x: 0.7, y: 0.6, intensity: 1.2 },
      ]);

      expect(scene3d.partialVfxGroup.children.length).toBe(3);

      // Advance animation loop
      scene3d.update(1.5, 1.2);
      expect(scene3d.camera.position.z).toBeGreaterThan(0);

      // Clean disposal
      scene3d.dispose();
      expect(scene3d.scene.children.length).toBe(0);
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
