import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { UniversalCanvasEngine } from '../packages/effect-engines/src/canvas/UniversalCanvasEngine';

describe('Iteration 8 Phase 1: Declarative Particle & HUD Subsystem', () => {
  describe('UniversalCanvasEngine Declarative API', () => {
    it('should initialize without particles or HUD by default', () => {
      const engine = new UniversalCanvasEngine({ width: 1280, height: 720 });
      expect(engine.hasParticles()).toBe(false);
      expect(engine.hasHologramHUD()).toBe(false);
      engine.dispose();
    });

    it('should dynamically initialize and clear particle system on demand', () => {
      const engine = new UniversalCanvasEngine({ width: 1280, height: 720 });
      expect(engine.hasParticles()).toBe(false);

      engine.initParticleSystem(150, 42);
      expect(engine.hasParticles()).toBe(true);

      engine.clearParticles();
      expect(engine.hasParticles()).toBe(false);

      engine.setParticleConfig({ count: 100 });
      expect(engine.hasParticles()).toBe(true);

      engine.setParticleConfig(null);
      expect(engine.hasParticles()).toBe(false);
      engine.dispose();
    });

    it('should dynamically initialize, configure and clear hologram HUD on demand', () => {
      const engine = new UniversalCanvasEngine({ width: 1280, height: 720 });
      expect(engine.hasHologramHUD()).toBe(false);

      engine.initHologramHUD(0.4, 45, '#ec4899', 0.8);
      expect(engine.hasHologramHUD()).toBe(true);

      engine.setHUDConfig({
        ringRadiusNorm: 0.25,
        scanlineDensity: 30,
        color: '#38bdf8',
        rotationSpeed: 1.2,
      });
      expect(engine.hasHologramHUD()).toBe(true);

      engine.clearHologramHUD();
      expect(engine.hasHologramHUD()).toBe(false);

      engine.setHUDConfig({
        ringRadiusNorm: 0.3,
        scanlineDensity: 40,
        color: '#22c55e',
        rotationSpeed: 0.5,
      });
      expect(engine.hasHologramHUD()).toBe(true);

      engine.clearHUD();
      expect(engine.hasHologramHUD()).toBe(false);

      engine.dispose();
    });
  });

  describe('Preview.tsx Declarative Integration Source Verification', () => {
    const previewFile = path.resolve(process.cwd(), 'apps/studio/src/components/Preview.tsx');
    const previewDir = path.resolve(process.cwd(), 'apps/studio/src/components/preview');

    const getCombinedCode = () => {
      let combined = fs.readFileSync(previewFile, 'utf8');
      if (fs.existsSync(previewDir)) {
        const files = fs.readdirSync(previewDir);
        for (const f of files) {
          if (f.endsWith('.tsx') || f.endsWith('.ts')) {
            combined += '\n' + fs.readFileSync(path.join(previewDir, f), 'utf8');
          }
        }
      }
      return combined;
    };

    it('should NOT contain hardcoded initHologramHUD or initParticleSystem in engine mount effect', () => {
      const code = fs.readFileSync(previewFile, 'utf-8');

      // The mounting useEffect initializes IRPreviewEngine and does not hardcode ad-hoc effects
      expect(code).toContain('previewEngineRef.current = engine');
      expect(code).not.toContain('engine.initHologramHUD');
      expect(code).not.toContain('engine.initParticleSystem');
    });

    it('should dynamically bind particles and HUD to active sequence modifiers via IRPreviewEngine', () => {
      const code = getCombinedCode();
      // IRPreviewEngine dynamically dispatches all active modifiers (particles, HUD, VFX) via ModifierPluginRegistry
      expect(code).toContain('engine.renderFrame(currentFrame');
      expect(code).toContain('showVfxAmbiance');
    });

    it('should provide a VFX Ambiance toggle button in Viewport Control Bar', () => {
      const code = getCombinedCode();
      expect(code).toContain('showVfxAmbiance');
      expect(code).toContain('setShowVfxAmbiance');
      expect(code).toContain('VFX Ambiance (HUD & Particles)');
    });
  });
});
