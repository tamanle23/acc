import { describe, it, expect } from 'bun:test';
import { PipelineIRToUniversalIRAdapter } from '@acc/ir';
import type { PipelineIR, FineGrainedVideoDirectorConfig } from '@acc/ir';
import {
  ContentStrategyRegistry,
  registerAll250ContentStrategies,
  createUnifiedPipelineContext,
} from '@acc/core';
import type { OmnichannelOutput } from '../../packages/core/src/conductor/interfaces/IContentTaskStrategy';

describe('Fine-Grained Polymorphic Video Director Control', () => {
  const createMockPipelineIR = (): PipelineIR => ({
    schemaVersion: '3.0.0',
    pipelineId: 'scraper-summarizer',
    metadata: {
      jobId: 'job_test_director',
      title: 'Crypto Market Daily Pulse',
      createdAt: new Date().toISOString(),
      tags: ['crypto', 'market', 'daily'],
    },
    chunks: [
      {
        id: 'chunk_hook',
        order: 0,
        text: 'Bitcoin surges past $95k as institutional inflows accelerate!',
        spokenAudioPath: '/audio/hook.mp3',
        durationMs: 4000,
      },
      {
        id: 'chunk_body_1',
        order: 1,
        text: 'Solana and Ethereum follow closely with double-digit ecosystem growth.',
        spokenAudioPath: '/audio/body1.mp3',
        durationMs: 6000,
      },
      {
        id: 'chunk_outro',
        order: 2,
        text: 'Subscribe and stay ahead of the next macro liquidity rotation.',
        spokenAudioPath: '/audio/outro.mp3',
        durationMs: 3000,
      },
    ],
  });

  describe('Tier 1: Global Canvas, Color Grading & Audio Staging', () => {
    it('should map canvas dimensions and platform for different aspect ratios and resolutions', () => {
      const ir = createMockPipelineIR();

      // 16:9 YouTube 4K
      const config16x9: FineGrainedVideoDirectorConfig = {
        canvas: {
          aspectRatio: '16:9',
          fps: 60,
          resolution: '4k',
        },
      };
      const irDoc1 = PipelineIRToUniversalIRAdapter.adapt(ir, 'test_16x9', undefined, config16x9);
      expect(irDoc1.meta.canvasSize).toEqual({ w: 3840, h: 2160 });
      expect(irDoc1.meta.globalFps).toBe(60);
      expect(irDoc1.meta.targetPlatform).toBe('youtube');

      // 9:16 TikTok 1080p
      const config9x16: FineGrainedVideoDirectorConfig = {
        canvas: {
          aspectRatio: '9:16',
          fps: 30,
        },
      };
      const irDoc2 = PipelineIRToUniversalIRAdapter.adapt(ir, 'test_9x16', undefined, config9x16);
      expect(irDoc2.meta.canvasSize).toEqual({ w: 1080, h: 1920 });
      expect(irDoc2.meta.targetPlatform).toBe('tiktok');

      // 1:1 Instagram
      const configSquare: FineGrainedVideoDirectorConfig = {
        canvas: {
          aspectRatio: '1:1',
          fps: 30,
        },
      };
      const irDoc3 = PipelineIRToUniversalIRAdapter.adapt(ir, 'test_square', undefined, configSquare);
      expect(irDoc3.meta.canvasSize).toEqual({ w: 1080, h: 1080 });
      expect(irDoc3.meta.targetPlatform).toBe('instagram');
    });

    it('should compile global color grading LUT into track modifiers', () => {
      const ir = createMockPipelineIR();
      const config: FineGrainedVideoDirectorConfig = {
        canvas: {
          aspectRatio: '9:16',
          colorGrading: {
            lutPreset: 'cyberpunk_neon',
            contrast: 1.15,
            vignette: 0.3,
          },
        },
      };

      const doc = PipelineIRToUniversalIRAdapter.adapt(ir, 'test_cg', undefined, config);
      const videoTrack = doc.tracks.find((t) => t.id === 'track_v1_main');
      expect(videoTrack?.modifiers).toBeDefined();

      const cgMod = videoTrack?.modifiers?.find((m) => m.type === 'vfx/color_grading');
      expect(cgMod).toBeDefined();
      expect(cgMod?.params).toEqual({
        lutPreset: 'cyberpunk_neon',
        lutPath: undefined,
        contrast: 1.15,
        saturation: 1.0,
        vignette: 0.3,
      });
    });

    it('should compile master BGM audio track with ducking envelope', () => {
      const ir = createMockPipelineIR();
      const config: FineGrainedVideoDirectorConfig = {
        audioStaging: {
          bgmTrack: '/assets/bgm/synth_pulse.mp3',
          autoDucking: true,
          duckingAttenuationDb: -16,
          masterBgmVolume: 0.75,
        },
      };

      const doc = PipelineIRToUniversalIRAdapter.adapt(ir, 'test_bgm', undefined, config);
      const bgmTrack = doc.tracks.find((t) => t.id === 'track_a2_bgm');
      expect(bgmTrack).toBeDefined();
      expect(bgmTrack?.sequences.length).toBe(1);

      const bgmSeq = bgmTrack?.sequences[0];
      expect(bgmSeq?.assetId).toBe('asset_bgm_master');
      expect(doc.assets?.[bgmSeq?.assetId || '']?.src).toBe('/assets/bgm/synth_pulse.mp3');

      const duckingMod = bgmSeq?.modifiers?.find((m) => m.type === 'audio/ducking');
      expect(duckingMod?.params).toEqual({
        autoDucking: true,
        attenuationDb: -16,
        volume: 0.75,
      });
    });
  });

  describe('Tier 2: Content Archetype Directives', () => {
    it('should forward domain visual knobs (crypto ticker, chart visuals) to track modifiers', () => {
      const ir = createMockPipelineIR();
      const config: FineGrainedVideoDirectorConfig = {
        archetypeDirectives: {
          cryptoVisuals: {
            tickerStyle: 'floating_hud',
            sentimentColorCoding: true,
            highlightTopGainers: true,
          },
        },
      };

      const doc = PipelineIRToUniversalIRAdapter.adapt(ir, 'test_archetype', undefined, config);
      const videoTrack = doc.tracks.find((t) => t.id === 'track_v1_main');
      const cryptoMod = videoTrack?.modifiers?.find((m) => m.type === 'vfx/crypto_ticker');
      expect(cryptoMod).toBeDefined();
      expect(cryptoMod?.params).toEqual({
        tickerStyle: 'floating_hud',
        sentimentColorCoding: true,
        highlightTopGainers: true,
      });
    });
  });

  describe('Tier 3: Timeline & Segment Director Overrides', () => {
    it('should compile segment-level 3D depth, Ken Burns motion, and transition modifiers', () => {
      const ir = createMockPipelineIR();
      const config: FineGrainedVideoDirectorConfig = {
        segments: [
          {
            index: 1, // Hook chunk
            depth3d: {
              mode: 'sandwich',
              parallaxFactor: 0.45,
            },
            cameraMotion: {
              type: 'dolly_zoom',
              intensity: 0.7,
            },
            transition: {
              type: 'glitch',
              durationMs: 500,
            },
          },
          {
            index: 2, // Body chunk
            depth3d: {
              mode: 'parallax_2_5d',
              parallaxFactor: 0.25,
            },
            cameraMotion: {
              type: 'ken_burns_zoom_in',
              intensity: 0.4,
            },
            transition: {
              type: 'crossfade',
              durationMs: 800,
            },
          },
        ],
      };

      const doc = PipelineIRToUniversalIRAdapter.adapt(ir, 'test_segments', undefined, config);
      const videoTrack = doc.tracks.find((t) => t.id === 'track_v1_main');
      expect(videoTrack?.sequences.length).toBe(3);

      // Check sequence 1
      const seq1 = videoTrack?.sequences[0];
      const depth1 = seq1?.modifiers?.find((m) => m.type === 'vfx/depth3d');
      expect(depth1?.params).toMatchObject({ mode: 'sandwich', parallaxFactor: 0.45 });

      const cam1 = seq1?.modifiers?.find((m) => m.type === 'transform/ken_burns');
      expect(cam1?.params).toEqual({ type: 'dolly_zoom', intensity: 0.7 });

      const trans1 = seq1?.modifiers?.find((m) => m.type === 'transition/glitch');
      expect(trans1?.params).toMatchObject({ durationFrames: 15 }); // 500ms @ 30fps

      // Check sequence 2
      const seq2 = videoTrack?.sequences[1];
      const depth2 = seq2?.modifiers?.find((m) => m.type === 'vfx/depth3d');
      expect(depth2?.params).toMatchObject({ mode: 'parallax_2_5d', parallaxFactor: 0.25 });

      const trans2 = seq2?.modifiers?.find((m) => m.type === 'transition/crossfade');
      expect(trans2?.params).toMatchObject({ durationFrames: 24 }); // 800ms @ 30fps
    });

    it('should stage SFX cues onto a dedicated audio track synced with video sequences', () => {
      const ir = createMockPipelineIR();
      const config: FineGrainedVideoDirectorConfig = {
        segments: [
          {
            index: 1,
            sfxCues: [
              { sfxType: 'impact_bass', offsetMs: 0, volume: 1.0 },
              { sfxType: 'whoosh', offsetMs: 3500, volume: 0.8 },
            ],
          },
        ],
      };

      const doc = PipelineIRToUniversalIRAdapter.adapt(ir, 'test_sfx', undefined, config);
      const sfxTrack = doc.tracks.find((t) => t.id === 'track_a3_sfx');
      expect(sfxTrack).toBeDefined();
      expect(sfxTrack?.sequences.length).toBe(2);

      const cue1 = sfxTrack?.sequences[0];
      expect(cue1?.time.start).toEqual({ syncWith: 'seq_1_vis', offsetFrames: 0 });
      expect(doc.assets?.[cue1?.assetId || '']?.src).toBe('sfx:impact_bass');

      const cue2 = sfxTrack?.sequences[1];
      expect(cue2?.time.start).toEqual({ syncWith: 'seq_1_vis', offsetFrames: 105 }); // 3500ms @ 30fps = 105 frames
      expect(doc.assets?.[cue2?.assetId || '']?.src).toBe('sfx:whoosh');
    });

    it('should map semantic roleDirectives (hook and outro) when explicit index is not provided', () => {
      const ir = createMockPipelineIR();
      const config: FineGrainedVideoDirectorConfig = {
        roleDirectives: {
          hook: {
            cameraMotion: { type: 'dolly_zoom', intensity: 0.9 },
          },
          outro: {
            cameraMotion: { type: 'ken_burns_zoom_out', intensity: 0.3 },
            transition: { type: 'crossfade', durationMs: 1000 },
          },
        },
      };

      const doc = PipelineIRToUniversalIRAdapter.adapt(ir, 'test_roles', undefined, config);
      const videoTrack = doc.tracks.find((t) => t.id === 'track_v1_main');

      // Hook (chunk index 0)
      const seqHook = videoTrack?.sequences[0];
      const camHook = seqHook?.modifiers?.find((m) => m.type === 'transform/ken_burns');
      expect(camHook?.params).toEqual({ type: 'dolly_zoom', intensity: 0.9 });

      // Outro (chunk index 2)
      const seqOutro = videoTrack?.sequences[2];
      const camOutro = seqOutro?.modifiers?.find((m) => m.type === 'transform/ken_burns');
      expect(camOutro?.params).toEqual({ type: 'ken_burns_zoom_out', intensity: 0.3 });
    });

    it('should generate timed_text track with custom typography preset and colors', () => {
      const ir = createMockPipelineIR();
      const config: FineGrainedVideoDirectorConfig = {
        typography: {
          preset: '3d_sandwich',
          highlightColor: '#00FFA3',
          placement: 'center',
        },
      };

      const doc = PipelineIRToUniversalIRAdapter.adapt(ir, 'test_typography', undefined, config);
      const textTrack = doc.tracks.find((t) => t.id === 'track_t1_captions');
      expect(textTrack).toBeDefined();
      expect(textTrack?.sequences.length).toBe(3);

      const textSeq1 = textTrack?.sequences[0];
      const typoMod = textSeq1?.modifiers?.find((m) => m.type === 'text/typography');
      expect(typoMod?.params).toMatchObject({
        preset: '3d_sandwich',
        highlightColor: '#00FFA3',
        yPositionRatio: 0.5,
      });
    });
  });

  describe('End-to-End Concrete Strategy Execution', () => {
    registerAll250ContentStrategies();

    it('should execute item_002_market_crypto_recap with fine-grained director config and produce complete omnichannel deliverable', async () => {
      const strategy = ContentStrategyRegistry.getOrThrow('item_002_market_crypto_recap');

      const ctx = createUnifiedPipelineContext({
        pipelineId: 'scraper-summarizer',
        input: {
          title: 'Crypto Morning Alpha Recap',
          marketData: { btc: '+5.4%', sol: '+12.1%', eth: '+3.2%' },
          requestedModalities: ['video', 'social'],
          videoConfig: {
            canvas: {
              aspectRatio: '9:16',
              fps: 30,
              colorGrading: { lutPreset: 'cyberpunk_neon', contrast: 1.2 },
            },
            audioStaging: {
              bgmTrack: '/assets/bgm/neon_drive.mp3',
              autoDucking: true,
              duckingAttenuationDb: -18,
            },
            typography: {
              preset: '3d_sandwich',
              highlightColor: '#00FFA3',
            },
            archetypeDirectives: {
              cryptoVisuals: {
                tickerStyle: 'floating_hud',
                sentimentColorCoding: true,
              },
            },
            roleDirectives: {
              hook: {
                cameraMotion: { type: 'dolly_zoom', intensity: 0.8 },
                sfxCues: [{ sfxType: 'impact_bass', offsetMs: 0 }],
              },
            },
          },
          socialConfig: {
            platforms: ['twitter', 'linkedin'],
            customHashtags: ['#CryptoAlpha', '#Web3'],
          },
        },
      });

      const output = (await strategy.process(ctx)) as unknown as OmnichannelOutput;

      expect(output.contentTypeId).toBe('item_002_market_crypto_recap');
      expect(output.deliverables.social).toBeDefined();
      expect(output.deliverables.video).toBeDefined();

      const videoDeliverable = output.deliverables.video;
      expect(videoDeliverable?.videoSettings.aspectRatio).toBe('9:16');
      expect(videoDeliverable?.videoSettings.fps).toBe(30);

      const irDoc = videoDeliverable?.videoIRDoc;
      expect(irDoc).toBeDefined();
      expect(irDoc?.meta.canvasSize).toEqual({ w: 1080, h: 1920 });
      expect(irDoc?.meta.targetPlatform).toBe('tiktok');

      // Verify Video track has color grading & crypto ticker modifiers
      const videoTrack = irDoc?.tracks.find((t) => t.id === 'track_v1_main');
      expect(videoTrack?.modifiers?.some((m) => m.type === 'vfx/color_grading')).toBe(true);
      expect(videoTrack?.modifiers?.some((m) => m.type === 'vfx/crypto_ticker')).toBe(true);

      // Verify BGM track was staged
      const bgmTrack = irDoc?.tracks.find((t) => t.id === 'track_a2_bgm');
      expect(bgmTrack).toBeDefined();

      // Verify SFX track was staged
      const sfxTrack = irDoc?.tracks.find((t) => t.id === 'track_a3_sfx');
      expect(sfxTrack).toBeDefined();

      // Verify Captions track was staged with 3d_sandwich typography
      const captionTrack = irDoc?.tracks.find((t) => t.id === 'track_t1_captions');
      expect(captionTrack).toBeDefined();
    });

    it('should maintain backward compatibility when simple legacy videoConfig is supplied', async () => {
      const strategy = ContentStrategyRegistry.getOrThrow('item_002_market_crypto_recap');

      const ctx = createUnifiedPipelineContext({
        pipelineId: 'scraper-summarizer',
        input: {
          title: 'Legacy Config Test',
          requestedModalities: ['video'],
          videoConfig: {
            aspectRatio: '16:9',
            fps: 60,
            durationMs: 12000,
          },
        },
      });

      const output = (await strategy.process(ctx)) as unknown as OmnichannelOutput;
      expect(output.deliverables.video).toBeDefined();
      expect(output.deliverables.video?.videoSettings.aspectRatio).toBe('16:9');
      expect(output.deliverables.video?.videoSettings.fps).toBe(60);

      const irDoc = output.deliverables.video?.videoIRDoc;
      expect(irDoc?.meta.canvasSize).toEqual({ w: 1920, h: 1080 });
      expect(irDoc?.meta.globalFps).toBe(60);
      expect(irDoc?.meta.targetPlatform).toBe('youtube');
    });
  });
});
