import { describe, expect, test } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { LegacyStoryConfigAdapter, type LegacyStoryConfig } from '../packages/ir/src/LegacyStoryConfigAdapter';
import {
  EditingOpFactory,
  StandardCutStrategy,
  JCutLCutStrategy,
  PiPCompositorStrategy,
  SplitScreenCompositorStrategy
} from '../packages/effect-engines/src/editing';
import { ColorGradingEngine } from '../packages/effect-engines/src/styles/ColorGradingEngine';
import { SafeZoneManager } from '../packages/effect-engines/src/subtitles/SafeZoneManager';
import { AudioDuckingDSP } from '../packages/core/src/ffmpeg-ffi/AudioDuckingDSP';
import { WidgetExporter } from '../packages/exporters/src/interactive-web/WidgetExporter';
import { EditingPipelineOrchestrator } from '../apps/cli/src/pipelines/04-generative-story/EditingPipelineOrchestrator';
import { AutoReframeStrategy } from '../packages/effect-engines/src/vision/AutoReframeStrategy';
import { MulticamSynchronizer } from '../packages/core/src/multicam/MulticamSynchronizer';
import { KineticTypography } from '../packages/effect-engines/src/overlay-effects/KineticTypography';

describe('Systematic Video Editing Engine Unit & E2E Integration Tests', () => {
  describe('LegacyStoryConfigAdapter (Adapter Pattern)', () => {
    test('adapts legacy story config into ExtendedPipelineIR v3.1 AST', () => {
      const legacyConfig: LegacyStoryConfig = {
        name: 'Test Legacy Story',
        settings: {
          width: 1080,
          height: 1920,
          fps: 30,
          platform: 'tiktok',
          bgm: {
            source: 'assets/bgm.mp3',
            volume: 0.1,
            autoDucking: true,
          },
        },
        scenes: [
          {
            image: 'images/01.jpg',
            text: 'Hello world',
            duration: 4,
            captions: [
              { text: 'Hello', start: 0, end: 1.5 },
              { text: 'world', start: 1.5, end: 3.5 },
            ],
          },
          {
            video: 'videos/02.mp4',
            duration: 5,
          },
        ],
      };

      const adaptedIR = LegacyStoryConfigAdapter.adapt(legacyConfig, 'job_test_123');

      expect(adaptedIR.schemaVersion).toBe('3.1.0');
      expect(adaptedIR.metadata.jobId).toBe('job_test_123');
      expect(adaptedIR.metadata.title).toBe('Test Legacy Story');
      expect(adaptedIR.settings.resolution).toEqual({ width: 1080, height: 1920 });
      expect(adaptedIR.settings.platform).toBe('tiktok');
      expect(adaptedIR.extendedChunks.length).toBe(2);

      // Verify Scene 1 chunk
      const chunk1 = adaptedIR.extendedChunks[0];
      expect(chunk1.id).toBe('chunk_1');
      expect(chunk1.visualLayers.length).toBe(1);
      expect(chunk1.visualLayers[0].sourcePathOrBuffer).toBe('images/01.jpg');
      expect(chunk1.typographyOverlays.length).toBe(2);
      expect(chunk1.typographyOverlays[0].text).toBe('Hello');

      // Verify BGM Audio Track
      expect(adaptedIR.audioTracks.length).toBe(1);
      expect(adaptedIR.audioTracks[0].type).toBe('bgm');
      expect(adaptedIR.audioTracks[0].sourcePath).toBe('assets/bgm.mp3');
      expect(adaptedIR.audioComposition.ducking.enabled).toBe(true);
    });
  });

  describe('EditingOpFactory & Cut Strategies (Strategy & Factory Patterns)', () => {
    test('resolves StandardCutStrategy and computes full duration range', () => {
      const strategy = EditingOpFactory.getCutStrategy('standard_cut');
      expect(strategy).toBeInstanceOf(StandardCutStrategy);

      const result = strategy.calculateCut({
        id: 'chunk_1',
        order: 0,
        durationMs: 5000,
        visualLayers: [],
        typographyOverlays: [],
      });

      expect(result.splitEditType).toBe('standard');
      expect(result.videoRange).toEqual({ startMs: 0, endMs: 5000 });
      expect(result.audioRange).toEqual({ startMs: 0, endMs: 5000 });
    });

    test('resolves JCutLCutStrategy and computes audio lead-in offset', () => {
      const strategy = EditingOpFactory.getCutStrategy('j_cut', { offsetMs: 600 });
      expect(strategy).toBeInstanceOf(JCutLCutStrategy);

      const result = strategy.calculateCut({
        id: 'chunk_2',
        order: 1,
        durationMs: 4000,
        videoOffsetMs: 600,
        visualLayers: [],
        typographyOverlays: [],
      });

      expect(result.splitEditType).toBe('j_cut');
      expect(result.videoRange).toEqual({ startMs: 600, endMs: 4000 });
      expect(result.audioRange).toEqual({ startMs: 0, endMs: 4000 });
    });
  });

  describe('Compositor Strategies (Strategy Pattern)', () => {
    test('computes PiP viewports with secondary video scaled and positioned', () => {
      const pipStrategy = EditingOpFactory.getCompositorStrategy('pip', { scale: 0.3, corner: 'bottom_right' });
      expect(pipStrategy).toBeInstanceOf(PiPCompositorStrategy);

      const layout = pipStrategy.composeLayout(1080, 1920, [
        { id: 'layer_main', isPrimary: true },
        { id: 'layer_reaction' },
      ]);

      expect(layout.layoutMode).toBe('pip');
      expect(layout.viewports.length).toBe(2);

      // Primary background viewport
      expect(layout.viewports[0].layerId).toBe('layer_main');
      expect(layout.viewports[0].rect).toEqual({ x: 0, y: 0, width: 1080, height: 1920 });

      // Secondary PiP viewport
      const pipViewport = layout.viewports[1];
      expect(pipViewport.layerId).toBe('layer_reaction');
      expect(pipViewport.rect.width).toBe(Math.round(1080 * 0.3));
      expect(pipViewport.rect.height).toBe(Math.round(1920 * 0.3));
      expect(pipViewport.rect.x).toBe(1080 - Math.round(1080 * 0.3) - 24);
    });

    test('computes Split Screen viewports for multi-stream layout', () => {
      const splitStrategy = EditingOpFactory.getCompositorStrategy('split_screen', { orientation: 'horizontal' });
      expect(splitStrategy).toBeInstanceOf(SplitScreenCompositorStrategy);

      const layout = splitStrategy.composeLayout(1080, 1920, [
        { id: 'layer_top' },
        { id: 'layer_bottom' },
      ]);

      expect(layout.layoutMode).toBe('split_screen');
      expect(layout.viewports.length).toBe(2);
      expect(layout.viewports[0].rect).toEqual({ x: 0, y: 0, width: 1080, height: 960 });
      expect(layout.viewports[1].rect).toEqual({ x: 0, y: 960, width: 1080, height: 960 });
    });
  });

  describe('ColorGradingEngine & 3D LUT (Group 4.1)', () => {
    test('generates contrast, saturation and lut3d filter string', () => {
      const engine = new ColorGradingEngine();
      const filter = engine.generateFFmpegFilter({
        contrast: 1.1,
        saturation: 1.2,
        exposure: 0.05,
        lutPath: 'luts/cinematic.cube',
      });

      expect(filter).toContain('eq=contrast=1.10:saturation=1.20:brightness=0.05');
      expect(filter).toContain("lut3d=file='luts/cinematic.cube':interp=tetrahedral");
    });
  });

  describe('SafeZoneManager (Group 9.1)', () => {
    test('verifies bounding boxes in TikTok safe zones', () => {
      const margins = SafeZoneManager.getMargins('tiktok');
      expect(margins.topMarginPx).toBe(120);
      expect(margins.bottomMarginPx).toBe(220);

      const centerBox = { x: 200, y: 500, width: 400, height: 100 };
      expect(SafeZoneManager.isBoxInSafeZone(centerBox, 'tiktok')).toBe(true);

      const occludedBox = { x: 925, y: 900, width: 100, height: 100 };
      expect(SafeZoneManager.isBoxInSafeZone(occludedBox, 'tiktok')).toBe(false);
    });
  });

  describe('AudioDuckingDSP (Group 3.1 & 9.3)', () => {
    test('builds sidechain compress and loudnorm filter graphs', () => {
      const sidechain = AudioDuckingDSP.buildSidechainFilterGraph('voice', 'bgm', 'out', {
        attenuationDb: -18,
        attackMs: 20,
        releaseMs: 250,
      });

      expect(sidechain).toContain('sidechaincompress=threshold=-24dB');
      expect(sidechain).toContain('attack=20:release=250');

      const loudnorm = AudioDuckingDSP.buildEBUR128LoudnessFilter(-14.0);
      expect(loudnorm).toBe('loudnorm=I=-14.0:LRA=11:TP=-1.5');
    });
  });

  describe('WidgetExporter (Group 11.1)', () => {
    test('exports interactive HTML player and JSON tree file', () => {
      const tmpDir = path.join(os.tmpdir(), `acc_test_widget_${Date.now()}`);
      const ir = LegacyStoryConfigAdapter.adapt({
        name: 'Interactive Story',
        scenes: [{ text: 'Scene 1', duration: 3 }],
      });

      const { htmlPath, jsonPath } = WidgetExporter.exportInteractiveWidget(ir, {
        outputDir: tmpDir,
        autostart: true,
      });

      expect(fs.existsSync(htmlPath)).toBe(true);
      expect(fs.existsSync(jsonPath)).toBe(true);

      const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      expect(jsonContent.title).toBe('Interactive Story');

      // Cleanup
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('AutoReframeStrategy (Group 8.1)', () => {
    test('computes centered 9:16 crop box for focal subject on 1920x1080 source', () => {
      const autoReframe = new AutoReframeStrategy({
        sourceWidth: 1920,
        sourceHeight: 1080,
        targetAspectRatio: '9:16',
        smoothingFactor: 0.5,
      });

      const subjectBox = { x: 1200, y: 200, width: 300, height: 600 };
      const crop = autoReframe.calculateCropForSubject(subjectBox);

      // Target 9:16 width for 1080 height is 608px
      expect(crop.width).toBe(608);
      expect(crop.height).toBe(1080);
      // Center X = 1350, Crop X = 1350 - 304 = 1046
      expect(crop.x).toBe(1046);

      const filterStr = autoReframe.generateFFmpegCropFilter(crop);
      expect(filterStr).toBe('crop=608:1080:1046:0');
    });
  });

  describe('MulticamSynchronizer (Group 7.1)', () => {
    test('calculates cross-correlation lag offset between reference and target audio', () => {
      const sampleRate = 1000;
      const ref = new Float32Array(2000);
      const target = new Float32Array(2000);

      // Add signal peak at index 500 in ref, index 700 in target (lag = +200 samples = +200ms)
      for (let i = 0; i < 50; i++) {
        ref[500 + i] = 1.0;
        target[700 + i] = 1.0;
      }

      const result = MulticamSynchronizer.calculateWaveformOffset(ref, target, sampleRate, 2);
      expect(result.offsetMs).toBe(200);
      expect(result.confidenceScore).toBeGreaterThan(0.5);
    });
  });

  describe('KineticTypography (Group 6.3)', () => {
    test('solves spring physics pop-in scale sequence over time', () => {
      const scales = KineticTypography.generatePopInSequence(15, 30);
      expect(scales.length).toBe(15);
      expect(scales[0]).toBe(0.0);
      // Scale should spring overshoot around 1.0
      expect(Math.max(...scales)).toBeGreaterThan(0.9);
    });
  });

  describe('EditingPipelineOrchestrator End-to-End Flow', () => {
    test('orchestrates adaptation, strategy calculation, and filter graph assembly', async () => {
      const orchestrator = new EditingPipelineOrchestrator();
      const legacyConfig: LegacyStoryConfig = {
        name: 'Full E2E Test Story',
        settings: { platform: 'tiktok' },
        scenes: [
          { text: 'Hook', duration: 3, video: 'v1.mp4' },
          { text: 'Body', duration: 4, image: 'i1.jpg' },
        ],
      };

      const result = await orchestrator.processAndRender(legacyConfig, {
        outputDir: path.join(os.tmpdir(), 'acc_e2e_out'),
      });

      expect(result.ir.metadata.title).toBe('Full E2E Test Story');
      expect(result.ir.extendedChunks.length).toBe(2);
      expect(result.filterGraphString).toContain('eq=contrast=1.05');
      expect(result.filterGraphString).toContain('sidechaincompress');
    });
  });
});
