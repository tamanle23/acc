import { describe, expect, test } from 'bun:test';
import { LegacyStoryConfigAdapter, type LegacyStoryConfig } from '../packages/ir/src/LegacyStoryConfigAdapter';
import {
  EditingOpFactory,
  StandardCutStrategy,
  JCutLCutStrategy,
  PiPCompositorStrategy,
  SplitScreenCompositorStrategy
} from '../packages/effect-engines/src/editing';

describe('Systematic Video Editing Engine Unit Tests', () => {
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
});
