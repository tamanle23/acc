import { describe, it, expect, beforeEach } from 'bun:test';
import { GSAP_EASING_PRESETS } from '../apps/studio/src/components/EasingCurveSelector';
import { ProceduralAudioSynthesizer } from '../packages/effect-engines/src/audio/ProceduralAudioSynthesizer';
import { STAGING_PRESETS } from '../apps/studio/src/lib/library/stagingPresets';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';
import fs from 'fs';
import path from 'path';

describe('Phase 5: GSAP Easing Inspector & Sidebar Enhancements', () => {
  beforeEach(async () => {
    await IRStateManager.getInstance().switchTemplate('scifi');
  });

  describe('1. GSAP Easing Curve Presets', () => {
    it('defines 7 standard GSAP easing curves with SVG paths', () => {
      expect(GSAP_EASING_PRESETS).toBeDefined();
      expect(GSAP_EASING_PRESETS.length).toBe(7);

      const easeValues = GSAP_EASING_PRESETS.map((p) => p.id);
      expect(easeValues).toContain('linear');
      expect(easeValues).toContain('power2.out');
      expect(easeValues).toContain('power2.inOut');
      expect(easeValues).toContain('back.out');
      expect(easeValues).toContain('elastic.out');
      expect(easeValues).toContain('bounce.out');
      expect(easeValues).toContain('expo.out');

      for (const preset of GSAP_EASING_PRESETS) {
        expect(preset.name).toBeTruthy();
        expect(preset.path).toMatch(/^M\s*0/);
      }
    });
  });

  describe('2. Procedural Audio Synthesizer (Pure DSP)', () => {
    it('synthesizes whoosh, impact, glitch, and riser audio buffers as Float32Array', () => {
      const sampleRate = 44100;
      const duration = 0.5;
      const expectedSamples = Math.floor(sampleRate * duration);

      const whoosh = ProceduralAudioSynthesizer.synthWhoosh(0, duration, sampleRate);
      expect(whoosh).toBeInstanceOf(Float32Array);
      expect(whoosh.length).toBe(expectedSamples);

      const impact = ProceduralAudioSynthesizer.synthImpact(0, duration, sampleRate);
      expect(impact).toBeInstanceOf(Float32Array);
      expect(impact.length).toBe(expectedSamples);

      const glitch = ProceduralAudioSynthesizer.synthGlitch(0, duration, sampleRate);
      expect(glitch).toBeInstanceOf(Float32Array);
      expect(glitch.length).toBe(expectedSamples);

      const riser = ProceduralAudioSynthesizer.synthRiser(0, duration, sampleRate);
      expect(riser).toBeInstanceOf(Float32Array);
      expect(riser.length).toBe(expectedSamples);

      // Verify bounds and non-silence
      for (const buf of [whoosh, impact, glitch, riser]) {
        let maxAmp = 0;
        for (let i = 0; i < buf.length; i++) {
          const abs = Math.abs(buf[i]);
          if (abs > maxAmp) maxAmp = abs;
          expect(abs).toBeLessThanOrEqual(1.05); // clamped with safe ceiling
        }
        expect(maxAmp).toBeGreaterThan(0.01); // not silent
      }
    });
  });

  describe('3. Staging Presets SFX Category', () => {
    it('registers sfx staging presets targeting track-audio', () => {
      const sfxPresets = STAGING_PRESETS.filter((p) => p.category === 'sfx');
      expect(sfxPresets.length).toBeGreaterThanOrEqual(4);

      const ids = sfxPresets.map((p) => p.id);
      expect(ids).toContain('sfx_impact');
      expect(ids).toContain('sfx_whoosh');
      expect(ids).toContain('sfx_glitch');
      expect(ids).toContain('sfx_riser');

      for (const preset of sfxPresets) {
        expect(preset.targetTrackId).toBe('track-audio');
        expect(preset.targetTrackType).toBe('audio');
        const seq = preset.createSequence({ startFrame: 15, normX: 0.5, normY: 0.5 });
        expect(seq.time.start).toBe(15);
        expect(seq.modifiers.length).toBeGreaterThan(0);
        expect(seq.modifiers.some((m) => m.type === 'sfx/procedural')).toBe(true);
        expect(seq.modifiers.some((m) => m.type === 'transform')).toBe(true);
      }
    });
  });

  describe('4. IRStateManager Asset Management', () => {
    it('adds new asset metadata records via addAsset', () => {
      const manager = IRStateManager.getInstance();
      const testAssetId = 'asset_test_123';
      const testAsset = {
        id: testAssetId,
        type: 'audio' as const,
        src: 'blob:http://localhost:5173/mock-audio-uuid',
        name: 'sample_sfx.wav',
        size: 10240,
      };

      manager.addAsset(testAssetId, testAsset);

      const state = manager.getState();
      expect(state.doc.assets).toBeDefined();
      expect(state.doc.assets![testAssetId]).toBeDefined();
      expect(state.doc.assets![testAssetId].name).toBe('sample_sfx.wav');
      expect(state.doc.assets![testAssetId].type).toBe('audio');
    });
  });

  describe('5. Component Integration & Verification', () => {
    it('verifies RightSidebar contains EasingCurveSelector and procedural SFX controls', () => {
      const rightSidebarCode = fs.readFileSync(
        path.join(__dirname, '../apps/studio/src/components/RightSidebar.tsx'),
        'utf-8'
      );
      expect(rightSidebarCode).toContain('<EasingCurveSelector');
      expect(rightSidebarCode).toContain('value="procedural_sfx"');
      expect(rightSidebarCode).toContain('handleAuditionSFX');
      expect(rightSidebarCode).toContain('handleInsertProceduralSFX');
      expect(rightSidebarCode).toContain('ProceduralAudioSynthesizer.synthWhoosh');
    });

    it('verifies LeftSidebar contains SFX category pills, non-intrusive card styling, and dropzone', () => {
      const leftSidebarCode = fs.readFileSync(
        path.join(__dirname, '../apps/studio/src/components/LeftSidebar.tsx'),
        'utf-8'
      );
      expect(leftSidebarCode).toContain("'sfx'");
      expect(leftSidebarCode).toContain('hover:-translate-y-0.5');
      expect(leftSidebarCode).toContain('handleFilesIngest');
      expect(leftSidebarCode).toContain('UploadCloud');
      expect(leftSidebarCode).toContain('Click or drag files here');
    });

    it('verifies CSS contains travelCurve keyframes for easing preview', () => {
      const cssCode = fs.readFileSync(
        path.join(__dirname, '../apps/studio/src/index.css'),
        'utf-8'
      );
      expect(cssCode).toContain('@keyframes travelCurve');
    });
  });
});
