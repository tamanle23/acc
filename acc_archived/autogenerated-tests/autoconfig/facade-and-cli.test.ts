import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  AutoConfigEngineFacade,
  type AutoScaffoldResult,
} from '@acc/core';

describe('Universal Auto-Config Phase 5: Facade & CLI Modernization', () => {
  let tempTestDir: string;

  beforeAll(() => {
    tempTestDir = path.join(os.tmpdir(), `acc-facade-test-${Date.now()}`);
    fs.mkdirSync(tempTestDir, { recursive: true });

    // Create synthetic assets
    fs.mkdirSync(path.join(tempTestDir, 'images'), { recursive: true });
    fs.mkdirSync(path.join(tempTestDir, 'audio'), { recursive: true });

    fs.writeFileSync(path.join(tempTestDir, 'images', '01.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    fs.writeFileSync(path.join(tempTestDir, 'images', '02.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    fs.writeFileSync(path.join(tempTestDir, 'audio', '01.mp3'), Buffer.alloc(128));
    fs.writeFileSync(path.join(tempTestDir, 'audio', 'bgm.mp3'), Buffer.alloc(256));
    fs.writeFileSync(path.join(tempTestDir, 'script.txt'), 'Scene 1 line.\nScene 2 line.');
  });

  afterAll(() => {
    if (fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
  });

  describe('inspectDirectory', () => {
    it('should non-destructively inspect target directory without creating files', async () => {
      const { manifest, resolution } = await AutoConfigEngineFacade.inspectDirectory(tempTestDir);

      expect(manifest.visuals.length).toBe(2);
      expect(manifest.audio.length).toBe(2);
      expect(manifest.scripts.length).toBe(1);
      expect(resolution.confidence).toBeGreaterThan(0.5);
      expect(resolution.strategy.pipelineId).toBe('4');

      // Verify no config files were emitted
      expect(fs.existsSync(path.join(tempTestDir, 'pipeline-ir.json'))).toBe(false);
      expect(fs.existsSync(path.join(tempTestDir, 'story-config.json'))).toBe(false);
    });

    it('should throw clear error when inspecting non-existent directory', async () => {
      const nonExistentDir = path.join(tempTestDir, 'does-not-exist');
      expect(AutoConfigEngineFacade.inspectDirectory(nonExistentDir)).rejects.toThrow('Target directory does not exist');
    });
  });

  describe('scaffoldDirectory Dry Run', () => {
    it('should return complete result without writing files when dryRun is true', async () => {
      const result: AutoScaffoldResult = await AutoConfigEngineFacade.scaffoldDirectory(tempTestDir, {
        dryRun: true,
      });

      expect(result.pipelineId).toBe('4');
      expect(result.pipelineIR.schemaVersion).toBe('3.0.0');
      expect(result.pipelineIR.chunks.length).toBe(2);
      expect(result.videoConfig.canvas?.colorGrading?.lutPreset).toBe('cinematic_teal_orange');
      expect(result.legacyStoryConfig).toBeUndefined();

      // No files saved in dry run
      expect(result.savedFiles.pipelineIRPath).toBeUndefined();
      expect(result.savedFiles.omnichannelConfigPath).toBeUndefined();
      expect(result.savedFiles.storyConfigPath).toBeUndefined();
      expect(fs.existsSync(path.join(tempTestDir, 'pipeline-ir.json'))).toBe(false);
    });
  });

  describe('scaffoldDirectory Real File Emission', () => {
    it('should scaffold directory emitting pipeline-ir.json and omnichannel-config.json, omitting story-config.json for new directories', async () => {
      // Ensure no story-config exists initially
      const storyPath = path.join(tempTestDir, 'story-config.json');
      if (fs.existsSync(storyPath)) fs.unlinkSync(storyPath);

      const result = await AutoConfigEngineFacade.scaffoldDirectory(tempTestDir, {
        aspectRatio: '9:16',
        fps: 30,
        enableDepth3D: true,
      });

      expect(result.savedFiles.pipelineIRPath).toBeDefined();
      expect(result.savedFiles.omnichannelConfigPath).toBeDefined();
      // story-config.json is deprecated: should NOT be generated for new directories
      expect(result.savedFiles.storyConfigPath).toBeUndefined();
      expect(fs.existsSync(storyPath)).toBe(false);

      // Verify pipeline-ir.json on disk
      const irPath = result.savedFiles.pipelineIRPath!;
      expect(fs.existsSync(irPath)).toBe(true);
      const parsedIR = JSON.parse(fs.readFileSync(irPath, 'utf-8'));
      expect(parsedIR.schemaVersion).toBe('3.0.0');
      expect(parsedIR.pipelineId).toBe('generative-storytelling');
      expect(parsedIR.chunks.length).toBe(2);

      // Verify omnichannel-config.json on disk
      const omnichannelPath = result.savedFiles.omnichannelConfigPath!;
      expect(fs.existsSync(omnichannelPath)).toBe(true);
      const parsedOmni = JSON.parse(fs.readFileSync(omnichannelPath, 'utf-8'));
      expect(parsedOmni.pipelineId).toBe('4');
      expect(parsedOmni.videoConfig.canvas.colorGrading.lutPreset).toBe('cinematic_teal_orange');
    });

    it('should update and merge story-config.json when it already exists in the directory (update/merge mode)', async () => {
      const storyPath = path.join(tempTestDir, 'story-config.json');
      // Pre-create existing legacy story-config with custom properties
      fs.writeFileSync(
        storyPath,
        JSON.stringify(
          {
            name: 'Original Legacy Story',
            customAuthorField: 'Antigravity Studio',
            settings: {
              customBitrate: '8000k',
            },
          },
          null,
          2
        ),
        'utf-8'
      );

      const result = await AutoConfigEngineFacade.scaffoldDirectory(tempTestDir, {
        aspectRatio: '9:16',
        fps: 30,
      });

      // In update/merge mode, storyConfigPath is populated and merged
      expect(result.savedFiles.storyConfigPath).toBeDefined();
      expect(fs.existsSync(storyPath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(storyPath, 'utf-8'));
      expect(parsed.customAuthorField).toBe('Antigravity Studio'); // Preserved
      expect(parsed.settings.customBitrate).toBe('8000k'); // Preserved
      expect(parsed.settings.width).toBe(1080); // Synced from scaffold
      expect(parsed.settings.height).toBe(1920); // Synced from scaffold
    });

    it('should explicitly generate story-config.json when exportLegacyStoryConfig is true', async () => {
      const storyPath = path.join(tempTestDir, 'story-config.json');
      if (fs.existsSync(storyPath)) fs.unlinkSync(storyPath);

      const result = await AutoConfigEngineFacade.scaffoldDirectory(tempTestDir, {
        exportLegacyStoryConfig: true,
      });

      expect(result.savedFiles.storyConfigPath).toBeDefined();
      expect(fs.existsSync(storyPath)).toBe(true);
    });

    it('should respect pipelineOverride when explicitly specified', async () => {
      const result = await AutoConfigEngineFacade.scaffoldDirectory(tempTestDir, {
        pipelineOverride: '1',
        dryRun: true,
      });

      expect(result.pipelineId).toBe('1');
      expect(result.pipelineIR.pipelineId).toBe('scraper-summarizer');
      expect(result.videoConfig.canvas?.colorGrading?.lutPreset).toBe('clean_tech');
    });

    it('should omit story-config.json when exportLegacyStoryConfig is false even if file exists', async () => {
      const storyPath = path.join(tempTestDir, 'story-config.json');
      fs.writeFileSync(storyPath, JSON.stringify({ test: true }), 'utf-8');

      const result = await AutoConfigEngineFacade.scaffoldDirectory(tempTestDir, {
        exportLegacyStoryConfig: false,
      });

      expect(result.savedFiles.storyConfigPath).toBeUndefined();
      expect(result.savedFiles.pipelineIRPath).toBeDefined();
    });
  });

  describe('Real sample-story Scaffolding', () => {
    it('should scaffold real sample-story with 100% confidence in dry-run mode', async () => {
      const sampleStoryDir = path.resolve('./sample-story');
      const result = await AutoConfigEngineFacade.scaffoldDirectory(sampleStoryDir, {
        dryRun: true,
      });

      expect(result.pipelineId).toBe('4');
      expect(result.pipelineIR.chunks.length).toBeGreaterThan(0);
      expect(result.legacyStoryConfig?.name).toBe('Dinosaur_Story');
    });
  });
});
