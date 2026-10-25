import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { CanvasParticleOverlayPlugin } from '../packages/ir/src/plugins/overlay/CanvasParticleOverlayPlugin';
import { HologramHUDPlugin } from '../packages/ir/src/plugins/overlay/HologramHUDPlugin';

describe('Iteration 8 Phase 1: Declarative Particle & HUD Subsystem', () => {
  describe('Modular Plugins Declarative API', () => {
    it('should initialize CanvasParticleOverlayPlugin and validate parameters', () => {
      const plugin = new CanvasParticleOverlayPlugin();
      expect(plugin.type).toBe('overlay/canvas_particles');
      expect(plugin.targetScope).toBe('both');

      expect(plugin.validate({ type: 'dust', intensity: 1.0 })).toBe(true);
      expect(plugin.validate(null)).toBe(false);
    });

    it('should initialize HologramHUDPlugin and validate parameters', () => {
      const plugin = new HologramHUDPlugin();
      expect(plugin.type).toBe('overlay/hologram_hud');
      expect(plugin.targetScope).toBe('both');

      expect(plugin.validate({ ringRadius: 0.35, scanlineDensity: 40 })).toBe(true);
      expect(plugin.validate(null)).toBe(false);
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
