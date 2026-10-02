import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { RegistryManager, renderSoundEffect, renderCompositeSound } from '../index';
import { FFmpegManager } from '@acc/core';
import fs from 'fs';
import path from 'path';

const tmpOutputDir = path.join(process.cwd(), 'scratch', 'test_sfx_quality_loop');

describe('Sound Effects Engine - Design Patterns & Audio Quality Iteration Loop', () => {
  let registry: RegistryManager;

  beforeAll(async () => {
    await FFmpegManager.prepare();
    if (!fs.existsSync(tmpOutputDir)) {
      fs.mkdirSync(tmpOutputDir, { recursive: true });
    }
    registry = new RegistryManager('audioldm2-base');
  });

  afterAll(() => {
    if (fs.existsSync(tmpOutputDir)) {
      fs.rmSync(tmpOutputDir, { recursive: true, force: true });
    }
  });

  describe('1. Smart Router & Strategy Pattern Verification', () => {
    test('routes UI categories to FFmpeg Procedural Synth', () => {
      const generator = registry.getGenerator('ui');
      expect(generator.constructor.name).toBe('UI');
    });

    test('routes Fauna/Foley categories to Library (Freesound / Procedural)', () => {
      const generator = registry.getGenerator('fauna');
      expect(generator.constructor.name).toBe('GenericLibrary');
    });

    test('routes Cinematic/SciFi categories to AI / DSP Strategy', () => {
      const generator = registry.getGenerator('cinematic');
      expect(generator.constructor.name).toBe('Cinematic');
    });

    test('routes unknown category to AI / DSP Fallback Strategy', () => {
      const generator = registry.getGenerator('unknown_alien_sound');
      expect(generator.constructor.name).toBe('Fallback');
    });
  });

  describe('2. Registry Catalog & Discovery Methods', () => {
    test('exposes available composite sound names', () => {
      const composites = registry.getAvailableComposites();
      expect(composites).toContain('kaiju_roar');
      expect(composites).toContain('stormy_night');
      expect(composites).toContain('cafe_notification');
      expect(composites).toContain('cinematic_trailer_hit');
    });

    test('exposes available top-level sound effect categories', () => {
      const effects = registry.getAvailableEffects();
      expect(effects).toContain('ui');
      expect(effects).toContain('cinematic');
      expect(effects).toContain('scifi');
      expect(effects).toContain('foley');
      expect(effects).toContain('diegetic');
      expect(effects).toContain('fauna');
    });

    test('exposes available variants for a category', () => {
      const uiVariants = registry.getAvailableVariants('ui');
      expect(uiVariants).toContain('hover');
      expect(uiVariants).toContain('click');
      expect(uiVariants).toContain('success');

      const scifiVariants = registry.getAvailableVariants('scifi');
      expect(scifiVariants).toContain('laser');
      expect(scifiVariants).toContain('warp_drive');
    });

    test('exposes available sub-variants for effect/variant', () => {
      const subVariants = registry.getAvailableSubVariants('ui', 'success');
      expect(subVariants).toContain('chime');
    });
  });

  describe('3. Iteration Loop Quality Benchmark Tests', () => {
    test('generates and normalizes UI hover sound effect with DSP ADSR envelope', async () => {
      const wavPath = await renderSoundEffect(
        registry,
        'ui',
        'hover',
        'subtle_pop',
        0.5,
        tmpOutputDir
      );

      expect(fs.existsSync(wavPath)).toBe(true);
      const stat = fs.statSync(wavPath);
      expect(stat.size).toBeGreaterThan(1000); // Non-empty audio WAV

      const jsonPath = wavPath.replace(/_normalized\.wav$/, '.json');
      if (fs.existsSync(jsonPath)) {
        const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        expect(meta.is_normalized).toBe(true);
        expect(meta.loudness).toBe('-16 LUFS');
      }
    });

    test('generates and normalizes UI success chime audio', async () => {
      const wavPath = await renderSoundEffect(
        registry,
        'ui',
        'success',
        'chime',
        1.0,
        tmpOutputDir
      );

      expect(fs.existsSync(wavPath)).toBe(true);
      expect(fs.statSync(wavPath).size).toBeGreaterThan(2000);
    });

    test('generates and normalizes SciFi laser blast audio', async () => {
      const wavPath = await renderSoundEffect(
        registry,
        'scifi',
        'laser',
        'pew_blast',
        0.8,
        tmpOutputDir
      );

      expect(fs.existsSync(wavPath)).toBe(true);
      expect(fs.statSync(wavPath).size).toBeGreaterThan(2000);
    });

    test('generates multi-layer composite sound with auto-ducking sidechain compression', async () => {
      const outputs = await renderCompositeSound(
        registry,
        'cafe_notification',
        tmpOutputDir
      );

      expect(outputs.length).toBeGreaterThan(1);
      const finalComposite = outputs[outputs.length - 1];
      expect(fs.existsSync(finalComposite)).toBe(true);
      expect(fs.statSync(finalComposite).size).toBeGreaterThan(5000);

      const jsonPath = path.join(tmpOutputDir, 'cafe_notification_composite.json');
      expect(fs.existsSync(jsonPath)).toBe(true);
      const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      expect(meta.isComposite).toBe(true);
      expect(meta.isNormalized).toBe(true);
    });
  });
});
