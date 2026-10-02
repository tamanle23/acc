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
  MulticamSynchronizer
} from '../packages/core';
import {
  KineticTypography,
  TrackingCalloutEngine
} from '../packages/effect-engines/src/overlay-effects';
import { AutoReframeStrategy } from '../packages/effect-engines/src/vision/AutoReframeStrategy';
import { WidgetExporter } from '../packages/exporters/src/interactive-web/WidgetExporter';
import { SpatialVideoExporter } from '../packages/exporters/src/video/SpatialVideoExporter';
import { EditingPipelineOrchestrator } from '../apps/cli/src/pipelines/04-generative-story/EditingPipelineOrchestrator';

describe('Systematic Video Editing Engine 13 Groups Comprehensive Test Suite', () => {
  // GROUP 1: CUTS & TRANSITIONS
  describe('Group 1: Cuts & Transitions', () => {
    test('1.1 & 1.3: Standard Cut & J/L-Cuts', () => {
      const jCut = EditingOpFactory.getCutStrategy('j_cut', { offsetMs: 500 });
      const calc = jCut.calculateCut({ id: 'c1', order: 0, durationMs: 4000, visualLayers: [], typographyOverlays: [] });
      expect(calc.splitEditType).toBe('j_cut');
      expect(calc.videoRange.startMs).toBe(500);
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

  // GROUP 3: AUDIO EDITING
  describe('Group 3: Audio Editing', () => {
    test('3.1: Sidechain Audio Ducking', () => {
      const filter = AudioDuckingDSP.buildSidechainFilterGraph('v', 'm', 'out', { attenuationDb: -18 });
      expect(filter).toContain('sidechaincompress=threshold=-24dB');
    });
  });

  // GROUP 4: VISUAL & EFFECTS
  describe('Group 4: Visual & Effects', () => {
    test('4.1: Color Correction 3D LUT', () => {
      const engine = new ColorGradingEngine();
      const filter = engine.generateFFmpegFilter({ contrast: 1.1, lutPath: 'lut.cube' });
      expect(filter).toContain('eq=contrast=1.10');
      expect(filter).toContain("lut3d=file='lut.cube'");
    });

    test('4.2: Vignette Mask Engine', () => {
      const maskStr = ParametricMaskEngine.generateFFmpegVignetteMask(1080, 1920, 0.5);
      expect(maskStr).toContain('vignette=angle=0.39');
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
    test('6.3: Kinetic Typography & Callouts', () => {
      const scales = KineticTypography.generatePopInSequence(10, 30);
      expect(scales[0]).toBe(0.0);

      const mockCtx = {
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        roundRect: () => {},
        fillText: () => {},
        measureText: () => ({ width: 100 }),
      };

      TrackingCalloutEngine.renderTrackingCallout(mockCtx, {
        labelText: 'Specs',
        targetPoint: { x: 500, y: 500 },
        boxOffset: { x: 50, y: -50 },
      });
    });
  });

  // GROUP 7: WORKFLOW & MULTICAM
  describe('Group 7: Workflow & Multicam', () => {
    test('7.1: Multicam Waveform Alignment', () => {
      const ref = new Float32Array(1000);
      const target = new Float32Array(1000);
      for (let i = 0; i < 20; i++) { ref[200 + i] = 1.0; target[300 + i] = 1.0; }
      const res = MulticamSynchronizer.calculateWaveformOffset(ref, target, 1000, 2);
      expect(res.offsetMs).toBe(100);
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

    test('8.2: Generative B-roll Engine', async () => {
      const res = await GenerativeBrollEngine.resolveGenerativeBroll({ prompt: 'cinematic forest', durationMs: 3000 });
      expect(res.isAiGenerated).toBe(true);
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
    test('10.2: Clean Plate Wire Removal Filter', () => {
      const filter = CleanPlateEngine.generateFFmpegInpaintFilter({ x: 100, y: 100, width: 50, height: 50 });
      expect(filter).toBe('delogo=x=100:y=100:w=50:h=50');
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
    test('13.2: VTubing Avatar Mesh Animation', () => {
      const mockCtx = {
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        beginPath: () => {},
        arc: () => {},
        ellipse: () => {},
        fill: () => {},
      };

      VTubingEngine.animateAvatarMesh(mockCtx, {
        mouthOpenRatio: 0.8,
        eyeBlinkLeft: false,
        eyeBlinkRight: false,
        headRotation: { pitch: 0, yaw: 0, roll: 5 },
      });
    });

    test('End-to-End Orchestrator', async () => {
      const orchestrator = new EditingPipelineOrchestrator();
      const res = await orchestrator.processAndRender({ name: 'G13 Orchestrator', scenes: [{ text: 'Scene 1', duration: 2 }] });
      expect(res.ir.metadata.title).toBe('G13 Orchestrator');
    });
  });
});
