import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';
import {
  MediaAssetProberChain,
  PipelineClassifierRegistry,
  AutoConfigEngineFacade,
} from '@acc/core';

describe('Sample Materials & Auto-Config Scaffolding Verification', () => {
  const samplesDir = path.resolve('samples');
  const prober = MediaAssetProberChain.createDefault();

  const sampleDefinitions = [
    {
      dir: '01-scraper-summarizer',
      expectedPipelineId: '1',
      expectedName: 'Scraper & Summarizer',
      expected3dMode: 'isometric_billboard',
      expectedOverlay: 'camera_ui',
      expectedSfx: 'assets/sfx_notification.wav',
    },
    {
      dir: '02-db-templating',
      expectedPipelineId: '2',
      expectedName: 'Database & Dynamic Templating',
      expected3dMode: 'isometric_podium',
      expectedOverlay: 'sci_fi_hud',
      expectedSfx: 'assets/sfx_data_blip.wav',
    },
    {
      dir: '03-repurposing-recycler',
      expectedPipelineId: '3',
      expectedName: 'Repurposing Recycler',
      expected3dMode: 'gyro_focal_tilt',
      expectedOverlay: 'vhs',
      expectedSfx: 'assets/sfx_pop.wav',
    },
    {
      dir: '04-generative-storytelling',
      expectedPipelineId: '4',
      expectedName: 'Generative Storytelling',
      expected3dMode: 'volumetric_sandwich',
      expectedOverlay: 'dust',
      expectedSfx: 'assets/sfx_cinematic_hit.wav',
    },
    {
      dir: '05-rule-logic',
      expectedPipelineId: '5',
      expectedName: 'Rule-Logic',
      expected3dMode: 'extruded_text_3d',
      expectedOverlay: 'confetti',
      expectedSfx: 'assets/sfx_chalk.wav',
    },
    {
      dir: '06-ambient-loops',
      expectedPipelineId: '6',
      expectedName: 'Ambient Loops',
      expected3dMode: 'macro_bokeh',
      expectedOverlay: 'rain_on_glass',
      expectedSfx: 'assets/sfx_rain_sound.wav',
    },
  ];

  it('should have all 6 sample directories created with required assets', () => {
    expect(fs.existsSync(samplesDir)).toBe(true);

    for (const def of sampleDefinitions) {
      const dirPath = path.join(samplesDir, def.dir);
      expect(fs.existsSync(dirPath)).toBe(true);
      expect(fs.existsSync(path.join(dirPath, 'assets'))).toBe(true);
      expect(fs.existsSync(path.join(dirPath, 'pipeline-ir.json'))).toBe(true);
      expect(fs.existsSync(path.join(dirPath, 'omnichannel-config.json'))).toBe(true);
      expect(fs.existsSync(path.join(dirPath, 'README.md'))).toBe(true);

      // Only Pipeline 4 maintains legacy story-config.json
      if (def.expectedPipelineId === '4') {
        expect(fs.existsSync(path.join(dirPath, 'story-config.json'))).toBe(true);
      } else {
        expect(fs.existsSync(path.join(dirPath, 'story-config.json'))).toBe(false);
      }
    }
  });

  it('should accurately probe and classify each sample directory with high confidence (>= 0.85)', async () => {
    for (const def of sampleDefinitions) {
      const dirPath = path.join(samplesDir, def.dir);
      const manifest = await prober.probeDirectory(dirPath, { probeDeepMetadata: false });
      const resolution = PipelineClassifierRegistry.resolve(manifest);

      expect(resolution.strategy.pipelineId).toBe(def.expectedPipelineId);
      expect(resolution.strategy.name).toContain(def.expectedName);
      expect(resolution.confidence).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('should verify 3D depth, overlay effects, and SFX cues across omnichannel-config.json and legacy story-config.json', () => {
    for (const def of sampleDefinitions) {
      const dirPath = path.join(samplesDir, def.dir);
      const omni = JSON.parse(fs.readFileSync(path.join(dirPath, 'omnichannel-config.json'), 'utf-8'));

      // 3D Depth
      expect(omni.videoConfig?.depth3d?.enabled).toBe(true);
      expect(omni.videoConfig?.depth3d?.mode).toBe(def.expected3dMode);

      // VFX Overlay
      expect(omni.videoConfig?.overlayComposite).toBe(def.expectedOverlay);

      // SFX Design
      expect(Array.isArray(omni.videoConfig?.sfx)).toBe(true);
      expect(omni.videoConfig?.sfx.length).toBeGreaterThan(0);
      expect(omni.videoConfig?.sfx.some((s: any) => s.source === def.expectedSfx)).toBe(true);

      // For Pipeline 4, verify legacy story-config.json parity
      if (def.expectedPipelineId === '4') {
        const sc = JSON.parse(fs.readFileSync(path.join(dirPath, 'story-config.json'), 'utf-8'));
        expect(sc.settings?.depth3d?.enabled).toBe(true);
        expect(sc.settings?.depth3d?.mode).toBe(def.expected3dMode);
        expect(sc.settings?.overlayComposite).toBe(def.expectedOverlay);
        expect(sc.settings?.sfx.some((s: any) => s.source === def.expectedSfx)).toBe(true);
      }
    }
  });

  it('should verify Universal Video IR v3.0.0 AST integration in pipeline-ir.json', () => {
    for (const def of sampleDefinitions) {
      const dirPath = path.join(samplesDir, def.dir);
      const ir = JSON.parse(fs.readFileSync(path.join(dirPath, 'pipeline-ir.json'), 'utf-8'));

      expect(ir.schemaVersion).toBe('3.0.0');
      expect(ir.metadata?.title).toBeTruthy();
      expect(ir.metadata?.overlayEffect).toBe(def.expectedOverlay);
      expect(ir.metadata?.depth3d?.mode).toBe(def.expected3dMode);
      expect(ir.audioComposition?.sfxMarkers?.length).toBeGreaterThan(0);
    }
  });

  it('should execute non-destructive dry-run scaffolding via AutoConfigEngineFacade without mutation', async () => {
    for (const def of sampleDefinitions) {
      const dirPath = path.join(samplesDir, def.dir);
      const result = await AutoConfigEngineFacade.scaffoldDirectory(dirPath, { dryRun: true });

      expect(result.pipelineId).toBe(def.expectedPipelineId);
      expect(result.pipelineIR).toBeDefined();
      expect(result.videoConfig).toBeDefined();
      expect(result.legacyStoryConfig).toBeDefined();
    }
  });
});
