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
  SplitScreenCompositorStrategy,
  CutawayOverlayCommand,
  MontageBeatSync,
  SpeedRampStrategy,
  SmashCutStrategy,
  ChromaKeyCompositorStrategy,
  HomographyCompositorStrategy,
  EquirectangularStitcher,
  VTubingEngine,
  TransitionFactory,
  GainNormalizeAudioDSP,
  KaraokeSubtitleMotionGraphics,
  VignetteDecorator,
  AudioDuckingDecorator,
  MoCapVTubeFacade,
} from '../packages/effect-engines/src/editing';
import {
  ColorGradingEngine,
  ParametricMaskEngine,
  LowerThirdFactory
} from '../packages/effect-engines/src/styles';
import { SafeZoneManager } from '../packages/effect-engines/src/subtitles/SafeZoneManager';
import {
  AudioDuckingDSP,
  ToneMappingEngine,
  CleanPlateEngine,
  MetadataArchiver,
  ProxyAssetManager,
  GenerativeBrollEngine,
  MulticamSynchronizer,
  EditingEngineFacade,
  EditingStageRunner,
  RenderTimelineCommand,
  ApplyColorGradingCommand,
  BurnSubtitleCommand,
  AnimateMaskCommand,
  HomographyTransformCommand,
  EmbedMetadataCommand,
  MulticamFacade,
  GenerativeAIFacade,
  VoiceIsolationCloningStrategy,
  MatchmoveVisionFacade,
  ModelHandleRegistry,
} from '../packages/core';
import {
  KineticTypography,
  TrackingCalloutEngine
} from '../packages/effect-engines/src/overlay-effects';
import { AutoReframeStrategy } from '../packages/effect-engines/src/vision/AutoReframeStrategy';
import { WidgetExporter } from '../packages/exporters/src/interactive-web/WidgetExporter';
import { SpatialVideoExporter } from '../packages/exporters/src/video/SpatialVideoExporter';
import { ZeroCopyRTMPStreamStrategy } from '../packages/exporters/src/live-stream/ZeroCopyRTMPStreamStrategy';
import { EditingPipelineOrchestrator } from '../apps/cli/src/pipelines/04-generative-story/EditingPipelineOrchestrator';

describe('Systematic Video Editing Engine Master Design Pattern Test Suite', () => {
  // FLYWEIGHT PATTERN: MODEL HANDLE REGISTRY
  describe('Flyweight Pattern: ModelHandleRegistry', () => {
    test('acquires, caches, registers, and manages AI model handles with memory tracking and eviction', async () => {
      const registry = ModelHandleRegistry.getInstance();
      registry.clearAll();

      let loadCount = 0;
      const modelLoader = async () => {
        loadCount++;
        return { name: 'kokoro-tts-v1', version: '1.0' };
      };

      // 1. acquireModel
      const m1 = await registry.acquireModel('kokoro-tts', modelLoader, 150);
      expect(m1.name).toBe('kokoro-tts-v1');
      expect(loadCount).toBe(1);

      // Re-acquiring should return cached handle without reloading
      const m2 = await registry.acquireModel('kokoro-tts', modelLoader, 150);
      expect(m2).toBe(m1);
      expect(loadCount).toBe(1);
      expect(registry.hasModel('kokoro-tts')).toBe(true);

      // 2. registerHandle & getHandle
      let disposed = false;
      const customHandle = { dispose: async () => { disposed = true; } };
      registry.registerHandle('custom-sam2', customHandle, 300);

      expect(registry.getHandle('custom-sam2')).toBe(customHandle);
      expect(registry.getActiveHandles()).toContain('kokoro-tts');
      expect(registry.getActiveHandles()).toContain('custom-sam2');
      expect(registry.getTotalMemoryUsageMB()).toBe(450); // 150 + 300

      // 3. releaseHandle
      const released = await registry.releaseHandle('custom-sam2');
      expect(released).toBe(true);
      expect(disposed).toBe(true);
      expect(registry.getHandle('custom-sam2')).toBeUndefined();
      expect(registry.getTotalMemoryUsageMB()).toBe(150);

      // 4. evictLowestPriorityHandle
      const evicted = await registry.evictLowestPriorityHandle();
      expect(evicted).toBe(true);
      expect(registry.getActiveHandles().length).toBe(0);

      registry.clearAll();
      expect(registry.hasModel('kokoro-tts')).toBe(false);
    });
  });

  // GROUP 1: CUTS & TRANSITIONS (STRATEGY & FACTORY PATTERNS)
  describe('Group 1: Cuts & Transitions (Strategy & Factory Patterns)', () => {
    test('1.1 & 1.3: Standard Cut & J/L-Cuts', () => {
      const jCut = EditingOpFactory.getCutStrategy('j_cut', { offsetMs: 500 });
      const calc = jCut.calculateCut({ id: 'c1', order: 0, durationMs: 4000, visualLayers: [], typographyOverlays: [] });
      expect(calc.splitEditType).toBe('j_cut');
      expect(calc.videoRange.startMs).toBe(500);
    });

    test('1.2: Transitions via TransitionFactory', () => {
      const fade = TransitionFactory.getTransition('fade');
      const filter = fade.generateFFmpegXfadeFilter('v0', 'v1', 'v_out', 3.0, 1.0);
      expect(filter).toContain('xfade=transition=fade:duration=1.00:offset=3.00');

      const glitch = TransitionFactory.getTransition('glitch_dissolve');
      expect(glitch.id).toBe('glitch_dissolve');
    });

    test('1.4: Cutaway B-roll Overlay Command', () => {
      const cmd = new CutawayOverlayCommand({ primaryClipId: 'c1', brollSourcePath: 'broll.mp4', startMs: 1000, durationMs: 2000 });
      const filter = cmd.generateFFmpegOverlayFilter();
      expect(filter).toContain("between(t,1.00,3.00)");
    });
  });

  // GROUP 2: PACING & TIMING
  describe('Group 2: Pacing & Timing', () => {
    test('2.1: Montage Beat Sync', () => {
      const beats = [{ timestampMs: 500, intensity: 1.0 }, { timestampMs: 1200, intensity: 1.0 }, { timestampMs: 1800, intensity: 1.0 }];
      const cuts = MontageBeatSync.calculateBeatCuts(beats, ['clip1.mp4', 'clip2.mp4']);
      expect(cuts.length).toBe(3);
      expect(cuts[0].clipPath).toBe('clip1.mp4');
    });

    test('2.2: Speed Ramping Cubic Bezier Interpolation', () => {
      const kf = [{ timeMs: 0, value: 1.0 }, { timeMs: 1000, value: 0.25 }, { timeMs: 2000, value: 2.0 }];
      const speedMid = SpeedRampStrategy.evaluateSpeedAtTime(kf, 500);
      expect(speedMid).toBeLessThan(1.0);
      expect(speedMid).toBeGreaterThan(0.25);
    });

    test('2.3: Smash Cut Gain Step', () => {
      const smash = new SmashCutStrategy();
      const filter = smash.generateFFmpegAudioGainStep(-24, -12);
      expect(filter).toBe('volume=12.0dB');
    });
  });

  // GROUP 3: AUDIO EDITING (DSP STRATEGY & DECORATOR PATTERNS)
  describe('Group 3: Audio Editing (DSP Strategy & Decorator Patterns)', () => {
    test('3.1: Sidechain Audio Ducking & Decorator', () => {
      const filter = AudioDuckingDSP.buildSidechainFilterGraph('v', 'm', 'out', { attenuationDb: -18 });
      expect(filter).toContain('sidechaincompress=threshold=-24dB');

      const duckingDecorator = new AudioDuckingDecorator('eq=contrast=1.1');
      const decoratedFilter = duckingDecorator.generateDecoratedFilterGraph('voice', 'bgm', 'out');
      expect(decoratedFilter).toContain('eq=contrast=1.1; [bgm][voice]sidechaincompress');
    });

    test('Audio DSP Strategy', () => {
      const dsp = new GainNormalizeAudioDSP();
      const buffer = new Float32Array([0.1, 0.5, -0.2]);
      const processed = dsp.processAudioBuffer(buffer, { gainDb: 6 });
      expect(processed[1]).toBeGreaterThan(0.5);
    });
  });

  // GROUP 4: VISUAL & EFFECTS (DECORATOR & MASK PATTERNS)
  describe('Group 4: Visual & Effects', () => {
    test('4.1: Color Correction 3D LUT', () => {
      const engine = new ColorGradingEngine();
      const filter = engine.generateFFmpegFilter({ contrast: 1.1, lutPath: 'lut.cube' });
      expect(filter).toContain('eq=contrast=1.10');
      expect(filter).toContain("lut3d=file='lut.cube'");
    });

    test('4.2: Vignette Mask Engine & Decorator', () => {
      const maskStr = ParametricMaskEngine.generateFFmpegVignetteMask(1080, 1920, 0.5);
      expect(maskStr).toContain('vignette=angle=0.39');

      const mockProducer = {
        renderFrame: (ctx: any) => { ctx.rendered = true; }
      };
      const decorator = new VignetteDecorator(mockProducer);
      const mockCtx = {
        rendered: false,
        save: () => {},
        restore: () => {},
        createRadialGradient: () => ({ addColorStop: () => {} }),
        fillRect: () => {},
      };
      decorator.renderFrame(mockCtx, 1080, 1920, 0);
      expect(mockCtx.rendered).toBe(true);
    });
  });

  // GROUP 5: COMPOSITING & SPATIAL LAYOUT
  describe('Group 5: Compositing & Spatial Layout', () => {
    test('5.1: PiP & Split Screen Layouts', () => {
      const pip = EditingOpFactory.getCompositorStrategy('pip');
      const layout = pip.composeLayout(1080, 1920, [{ id: 'l1', isPrimary: true }, { id: 'l2' }]);
      expect(layout.viewports.length).toBe(2);

      const split = EditingOpFactory.getCompositorStrategy('split_screen');
      const splitLayout = split.composeLayout(1080, 1920, [{ id: 'l1' }, { id: 'l2' }]);
      expect(splitLayout.viewports[0].rect.height).toBe(960);
    });

    test('5.2: Chroma Key Green Screen', () => {
      const filter = ChromaKeyCompositorStrategy.generateFFmpegChromaKeyFilter({ keyColorHex: '0x00FF00', similarity: 0.18 });
      expect(filter).toContain('chromakey=color=0x00FF00:similarity=0.18');
    });

    test('5.3: Homography Corner Pinning', () => {
      const src = { topLeft: { x: 0, y: 0 }, topRight: { x: 100, y: 0 }, bottomRight: { x: 100, y: 100 }, bottomLeft: { x: 0, y: 100 } };
      const dst = { topLeft: { x: 10, y: 10 }, topRight: { x: 110, y: 10 }, bottomRight: { x: 110, y: 110 }, bottomLeft: { x: 10, y: 110 } };
      const matrix = HomographyCompositorStrategy.calculate3x3HomographyMatrix(src, dst);
      expect(matrix[2]).toBe(10);
    });
  });

  // GROUP 6: TYPOGRAPHY & MOTION GRAPHICS
  describe('Group 6: Typography & Motion Graphics', () => {
    test('6.2 & 6.3: Motion Graphics Strategy & Kinetic Typography', () => {
      const motion = new KaraokeSubtitleMotionGraphics();
      const mockCtx = {
        save: () => {},
        restore: () => {},
        fillText: () => {},
      };
      motion.renderFrame(mockCtx, { text: 'Hello', canvasWidth: 1080, canvasHeight: 1920, progress: 0.5 });

      const scales = KineticTypography.generatePopInSequence(10, 30);
      expect(scales[0]).toBe(0.0);

      TrackingCalloutEngine.renderTrackingCallout({
        save: () => {}, restore: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {},
        moveTo: () => {}, lineTo: () => {}, stroke: () => {}, roundRect: () => {}, fillText: () => {},
        measureText: () => ({ width: 100 }),
      }, {
        labelText: 'Specs',
        targetPoint: { x: 500, y: 500 },
        boxOffset: { x: 50, y: -50 },
      });
    });
  });

  // GROUP 7: WORKFLOW & MULTICAM
  describe('Group 7: Workflow & Multicam', () => {
    test('7.1: Multicam Waveform Alignment & Facade', () => {
      const ref = { angleId: 'a1', sourcePath: 's1.mp4', audioSamples: new Float32Array(1000), sampleRate: 1000 };
      const target = { angleId: 'a2', sourcePath: 's2.mp4', audioSamples: new Float32Array(1000), sampleRate: 1000 };
      for (let i = 0; i < 20; i++) { ref.audioSamples[200 + i] = 1.0; target.audioSamples[300 + i] = 1.0; }

      const synced = MulticamFacade.syncAllCameraAngles(ref, [target]);
      expect(synced[0].offsetMs).toBe(100);
    });

    test('7.2: Proxy Asset Manager', () => {
      const manager = new ProxyAssetManager();
      manager.registerAsset('a1', 'raw.mp4', 'proxy.mp4');
      expect(manager.getResolvedPath('a1')).toBe('raw.mp4');
      manager.setProxyMode(true);
      expect(manager.getResolvedPath('a1')).toBe('proxy.mp4');
    });
  });

  // GROUP 8: AI-POWERED & GENERATIVE EDITING
  describe('Group 8: AI-Powered & Generative Editing', () => {
    test('8.1: Auto-Reframe 16:9 to 9:16', () => {
      const reframer = new AutoReframeStrategy({ sourceWidth: 1920, sourceHeight: 1080, targetAspectRatio: '9:16' });
      const crop = reframer.calculateCropForSubject({ x: 800, y: 200, width: 200, height: 400 });
      expect(crop.width).toBe(608);
      expect(crop.height).toBe(1080);
    });

    test('8.2 & 8.3: Generative AI Facade & Voice Cloning', async () => {
      const broll = await GenerativeAIFacade.generateBrollAsset({ prompt: 'forest', durationMs: 2000 });
      expect(broll).toContain('gen_broll_');

      const voice = await VoiceIsolationCloningStrategy.synthesizeClonedVoice({ referenceAudioPath: 'ref.mp3', targetText: 'Hello' });
      expect(voice).toContain('cloned_voice_');
    });
  });

  // GROUP 9: MASTERING & DELIVERY
  describe('Group 9: Mastering & Delivery', () => {
    test('9.1: Safe Zones', () => {
      const inZone = SafeZoneManager.isBoxInSafeZone({ x: 100, y: 200, width: 200, height: 100 }, 'tiktok');
      expect(inZone).toBe(true);
    });

    test('9.2: Tone Mapping Rec.2020 to Rec.709', () => {
      const filter = ToneMappingEngine.generateFFmpegToneMapFilter({ algorithm: 'hable' });
      expect(filter).toContain('tonemap=hable');
    });
  });

  // GROUP 10: VFX & CGI INTEGRATION
  describe('Group 10: VFX & CGI Integration', () => {
    test('10.2: Clean Plate Wire Removal & Matchmove Facade', async () => {
      const filter = CleanPlateEngine.generateFFmpegInpaintFilter({ x: 100, y: 100, width: 50, height: 50 });
      expect(filter).toBe('delogo=x=100:y=100:w=50:h=50');

      const tracks = await MatchmoveVisionFacade.calculate3DCameraTrajectory('video.mp4');
      expect(tracks.length).toBe(1);
    });
  });

  // GROUP 11: INTERACTIVE MEDIA & DAM
  describe('Group 11: Interactive Media & DAM', () => {
    test('11.1: Interactive Branching Widget', () => {
      const tmpDir = path.join(os.tmpdir(), `acc_widget_g11_${Date.now()}`);
      const ir = LegacyStoryConfigAdapter.adapt({ name: 'Interactive G11', scenes: [{ text: 'Branch 1', duration: 2 }] });
      const { htmlPath } = WidgetExporter.exportInteractiveWidget(ir, { outputDir: tmpDir });
      expect(fs.existsSync(htmlPath)).toBe(true);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('11.2: Metadata Tagging Args', () => {
      const ir = LegacyStoryConfigAdapter.adapt({ name: 'Metadata Story', settings: {} });
      const args = MetadataArchiver.generateFFmpegMetadataArgs(ir);
      expect(args).toContain('title=Metadata Story');
    });
  });

  // GROUP 12: IMMERSIVE & SPATIAL MEDIA
  describe('Group 12: Immersive & Spatial Media', () => {
    test('12.1: 360 Video Stitching', () => {
      const filter = EquirectangularStitcher.generateFFmpegV360Filter({ inputProjection: 'dual_fisheye', yawDeg: 10 });
      expect(filter).toBe('v360=input=dfisheye:output=equirect:yaw=10:pitch=0:roll=0');
    });

    test('12.2: Stereoscopic Spatial Video', () => {
      const filter = SpatialVideoExporter.generateStereoscopicFFmpegFilter({ outputDir: '/tmp', eyeDisparityPx: 64 });
      expect(filter).toContain('stereo3d=sbsl:sbsr');
    });
  });

  // GROUP 13: VIRTUAL PRODUCTION & REAL-TIME COMPOSITING
  describe('Group 13: Virtual Production & Real-time Compositing', () => {
    test('13.1: Zero-Copy RTMP Live Streaming Strategy', () => {
      const stream = new ZeroCopyRTMPStreamStrategy({ rtmpUrl: 'rtmp://localhost/live', width: 1920, height: 1080, fps: 30 });
      expect(stream.pushRgbaFramePointer(0n)).toBe(false);
      stream.startStream();
      expect(stream.pushRgbaFramePointer(0n)).toBe(true);
      stream.stopStream();
    });

    test('13.2: MoCap VTube Facade', () => {
      const mockCtx = {
        save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {},
        beginPath: () => {}, arc: () => {}, ellipse: () => {}, fill: () => {},
      };
      MoCapVTubeFacade.renderAvatarFrameFromLandmarks(mockCtx, {
        mouthOpenRatio: 0.8, eyeBlinkLeft: false, eyeBlinkRight: false, headRotation: { pitch: 0, yaw: 0, roll: 0 },
      });
    });
  });

  // DESIGN PATTERN FOUNDATION TESTS (FACADE, COMMAND, MIDDLEWARE)
  describe('Design Pattern Foundations (Facade, Command, Middleware)', () => {
    test('EditingEngineFacade renders timeline IR', async () => {
      const facade = new EditingEngineFacade();
      const ir = LegacyStoryConfigAdapter.adapt({ name: 'Facade Test', scenes: [{ text: 'Scene 1', duration: 2 }] });
      const res = await facade.renderTimeline(ir, { outputDir: '/tmp' });
      expect(res.jobId).toBe(ir.metadata.jobId);
    });

    test('EditingCommands execute and report cost estimates', async () => {
      const ir = LegacyStoryConfigAdapter.adapt({ name: 'Cmd Test' });
      const cmd = new RenderTimelineCommand(ir);
      const res = await cmd.execute({ base: true });
      expect(res.renderedJobId).toBe(ir.metadata.jobId);

      const colorCmd = new ApplyColorGradingCommand('lut.cube', 1.2, 1.3);
      const colorRes = await colorCmd.execute({});
      expect(colorRes.colorFilter).toContain('eq=contrast=1.20:saturation=1.30:lut3d=file=\'lut.cube\'');

      const subCmd = new BurnSubtitleCommand('Inter', 52);
      const subRes = await subCmd.execute({});
      expect(subRes.subtitleStyle).toContain('Style: Default,Inter,52');

      const maskCmd = new AnimateMaskCommand(500, 500, 200, 200);
      const maskRes = await maskCmd.execute({});
      expect(maskRes.activeMask).toEqual({ cx: 500, cy: 500, rx: 200, ry: 200 });

      const homoCmd = new HomographyTransformCommand();
      const homoRes = await homoCmd.execute({});
      expect(homoRes.homographyMatrix[2]).toBe(10);

      const metaCmd = new EmbedMetadataCommand('My Title', 'Author');
      const metaRes = await metaCmd.execute({});
      expect(metaRes.metadataArgs).toContain('title=My Title');
    });

    test('EditingStageRunner chains middleware with error boundary', async () => {
      const runner = new EditingStageRunner();
      let executedStage1 = false;
      let executedStage2 = false;

      runner.use({
        name: 'Stage1',
        execute: async (ctx, next) => {
          executedStage1 = true;
          await next();
        },
      });

      runner.use({
        name: 'Stage2_Failing',
        execute: async (ctx, next) => {
          executedStage2 = true;
          throw new Error('Failing middleware stage');
        },
      });

      const ir = LegacyStoryConfigAdapter.adapt({ name: 'Middleware Test' });
      await runner.run({ ir, intermediateFiles: [], filterGraphParts: [], metadata: {} });

      expect(executedStage1).toBe(true);
      expect(executedStage2).toBe(true);
    });

    test('EditingPipelineOrchestrator End-to-End Execution', async () => {
      const orchestrator = new EditingPipelineOrchestrator();
      const res = await orchestrator.processAndRender({ name: 'Master E2E Orchestrator', scenes: [{ text: 'Scene 1', duration: 2 }] });
      expect(res.ir.metadata.title).toBe('Master E2E Orchestrator');
    });
  });
});
