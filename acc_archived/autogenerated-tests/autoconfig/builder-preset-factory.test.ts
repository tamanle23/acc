import { describe, it, expect } from 'bun:test';
import {
  PipelineIRBuilder,
  DirectorPresetFactory,
  type DiscoveredAssetManifest,
  type ArchetypeScaffoldConfig,
} from '@acc/core';

describe('Universal Auto-Config Phase 3: Builder & Director Preset Factory', () => {
  describe('PipelineIRBuilder Mechanics & Fluent API', () => {
    it('should construct a valid minimal PipelineIR document', () => {
      const builder = new PipelineIRBuilder('generative-storytelling')
        .setTitle('Cyber Odyssey')
        .setAuthor('Test Director')
        .addTag('scifi')
        .addChunk({
          id: 'chunk-1',
          order: 1,
          text: 'In the neon depths...',
          durationMs: 3200,
        });

      const ir = builder.build();

      expect(ir.schemaVersion).toBe('3.0.0');
      expect(ir.pipelineId).toBe('generative-storytelling');
      expect(ir.metadata.title).toBe('Cyber Odyssey');
      expect(ir.metadata.author).toBe('Test Director');
      expect(ir.metadata.tags).toContain('scifi');
      expect(ir.chunks.length).toBe(1);
      expect(ir.chunks[0].durationMs).toBe(3200);
      expect(ir.audioComposition.ducking.enabled).toBe(true);
      expect(ir.audioComposition.ducking.attenuationDb).toBe(-14);
    });

    it('should throw validation error if no chunks are provided', () => {
      const builder = new PipelineIRBuilder('scraper-summarizer')
        .setTitle('Empty Project');

      expect(() => builder.build()).toThrow('At least one chunk must be defined');
    });

    it('should sort chunks by order and sanitize zero/negative durationMs', () => {
      const builder = new PipelineIRBuilder('generative-storytelling')
        .setTitle('Out of order chunks')
        .addChunk({ id: 'c3', order: 3, durationMs: -50 })
        .addChunk({ id: 'c1', order: 1, durationMs: 2000 })
        .addChunk({ id: 'c2', order: 2, durationMs: 0 });

      const ir = builder.build();

      expect(ir.chunks[0].id).toBe('c1');
      expect(ir.chunks[0].order).toBe(1);
      expect(ir.chunks[0].durationMs).toBe(2000);

      expect(ir.chunks[1].id).toBe('c2');
      expect(ir.chunks[1].order).toBe(2);
      expect(ir.chunks[1].durationMs).toBe(100); // Sanitized to >= 100ms

      expect(ir.chunks[2].id).toBe('c3');
      expect(ir.chunks[2].order).toBe(3);
      expect(ir.chunks[2].durationMs).toBe(100); // Sanitized to >= 100ms
    });

    it('should allow custom audio composition, structured data and distribution hints', () => {
      const builder = new PipelineIRBuilder('db-templating')
        .setTitle('Crypto Leaderboard')
        .setAudioComposition({
          backgroundMusic: { audioPath: 'bgm/upbeat.mp3', volume: 0.4, loop: true },
          ducking: { enabled: true, attenuationDb: -18, attackMs: 150, releaseMs: 400 },
        })
        .setStructuredData({ symbols: ['BTC', 'ETH'], source: 'binance' })
        .setDistributionHints({
          supportedExporters: ['video', 'social'],
          targetAspectRatios: ['16:9'],
        })
        .addChunk({ id: 'row-1', order: 1, durationMs: 4000 });

      const ir = builder.build();

      expect(ir.audioComposition.backgroundMusic?.audioPath).toBe('bgm/upbeat.mp3');
      expect(ir.audioComposition.ducking.attenuationDb).toBe(-18);
      expect(ir.structuredData?.symbols).toEqual(['BTC', 'ETH']);
      expect(ir.distributionHints.supportedExporters).toEqual(['video', 'social']);
      expect(ir.distributionHints.targetAspectRatios).toEqual(['16:9']);
    });
  });

  describe('PipelineIRBuilder Manifest Population', () => {
    it('should populate chunks and media bindings from paired asset pairs', () => {
      const mockManifest: DiscoveredAssetManifest = {
        baseDir: '/test/story',
        scannedAt: Date.now(),
        visuals: [
          {
            relativePath: 'visuals/01.png',
            absolutePath: '/test/story/visuals/01.png',
            fileName: '01.png',
            baseName: '01',
            extension: '.png',
            type: 'image',
            sizeBytes: 1024,
            width: 1080,
            height: 1920,
          },
          {
            relativePath: 'visuals/02.png',
            absolutePath: '/test/story/visuals/02.png',
            fileName: '02.png',
            baseName: '02',
            extension: '.png',
            type: 'image',
            sizeBytes: 1024,
            width: 1080,
            height: 1920,
          },
        ],
        audio: [
          {
            relativePath: 'audio/01.mp3',
            absolutePath: '/test/story/audio/01.mp3',
            fileName: '01.mp3',
            baseName: '01',
            extension: '.mp3',
            sizeBytes: 2048,
            durationMs: 4200,
            classification: 'voiceover',
          },
          {
            relativePath: 'audio/bgm.mp3',
            absolutePath: '/test/story/audio/bgm.mp3',
            fileName: 'bgm.mp3',
            baseName: 'bgm',
            extension: '.mp3',
            sizeBytes: 5000,
            durationMs: 30000,
            classification: 'music',
          },
        ],
        scripts: [],
        data: [],
        pairedPairs: [
          {
            index: 1,
            visual: {
              relativePath: 'visuals/01.png',
              absolutePath: '/test/story/visuals/01.png',
              fileName: '01.png',
              baseName: '01',
              extension: '.png',
              type: 'image',
              sizeBytes: 1024,
            },
            audio: {
              relativePath: 'audio/01.mp3',
              absolutePath: '/test/story/audio/01.mp3',
              fileName: '01.mp3',
              baseName: '01',
              extension: '.mp3',
              sizeBytes: 2048,
              durationMs: 4200,
              classification: 'voiceover',
            },
            scriptText: 'Once upon a time in Neo Tokyo',
          },
        ],
        suggestedTitle: 'Neo Tokyo Tale',
        totalVisualCount: 2,
        totalAudioCount: 2,
        hasVoiceover: true,
        hasBackgroundMusic: true,
      };

      const defaults: ArchetypeScaffoldConfig = {
        pipelineId: '4',
        canonicalPipelineId: 'generative-storytelling',
        suggestedTitle: 'Generic Story',
        suggestedModalities: ['video', 'social'],
        defaultAspect: '9:16',
        defaultFps: 30,
        chunkDurationMs: 4000,
      };

      const builder = new PipelineIRBuilder();
      builder.populateFromManifest(mockManifest, defaults);
      const ir = builder.build();

      expect(ir.pipelineId).toBe('generative-storytelling');
      expect(ir.metadata.title).toBe('Neo Tokyo Tale');
      expect(ir.chunks.length).toBe(1);
      expect(ir.chunks[0].text).toBe('Once upon a time in Neo Tokyo');
      expect(ir.chunks[0].spokenAudioPath).toBe('audio/01.mp3');
      expect(ir.chunks[0].durationMs).toBe(4200);
      expect(ir.chunks[0].visualAsset?.sourcePathOrBuffer).toBe('visuals/01.png');
      expect(ir.audioComposition.backgroundMusic?.audioPath).toBe('audio/bgm.mp3');
      expect(ir.audioComposition.narrationTrack?.loudnessLufs).toBe(-14);
    });

    it('should chunk raw script lines for text-only workspaces (Pipeline 1)', () => {
      const mockManifest: DiscoveredAssetManifest = {
        baseDir: '/test/scraper',
        scannedAt: Date.now(),
        visuals: [],
        audio: [],
        scripts: [
          {
            relativePath: 'summary.txt',
            absolutePath: '/test/scraper/summary.txt',
            fileName: 'summary.txt',
            extension: '.txt',
            content: 'Line 1 of analysis.\nLine 2 of market trends.',
            lines: ['Line 1 of analysis.', 'Line 2 of market trends.'],
            wordCount: 8,
            estimatedSpeechDurationMs: 3700,
          },
        ],
        data: [],
        pairedPairs: [],
        suggestedTitle: 'Market Analysis',
        totalVisualCount: 0,
        totalAudioCount: 0,
        hasVoiceover: false,
        hasBackgroundMusic: false,
      };

      const defaults: ArchetypeScaffoldConfig = {
        pipelineId: '1',
        canonicalPipelineId: 'scraper-summarizer',
        suggestedTitle: 'Market Analysis',
        suggestedModalities: ['video', 'social', 'web'],
        defaultAspect: '9:16',
        defaultFps: 30,
        chunkDurationMs: 3500,
      };

      const builder = new PipelineIRBuilder();
      builder.populateFromManifest(mockManifest, defaults);
      const ir = builder.build();

      expect(ir.pipelineId).toBe('scraper-summarizer');
      expect(ir.chunks.length).toBe(2);
      expect(ir.chunks[0].text).toBe('Line 1 of analysis.');
      expect(ir.chunks[1].text).toBe('Line 2 of market trends.');
      expect(ir.chunks[0].durationMs).toBeGreaterThan(1500);
    });
  });

  describe('DirectorPresetFactory Presets', () => {
    it('should generate canonical Pipeline 1 Scraper & Summarizer preset', () => {
      const config = DirectorPresetFactory.createForArchetype('1');

      expect(config.canvas?.colorGrading?.lutPreset).toBe('clean_tech');
      expect(config.typography?.preset).toBe('minimal_editorial');
      expect(config.roleDirectives?.hook?.cameraMotion?.type).toBe('ken_burns_zoom_in');
      expect(config.audioStaging?.autoDucking).toBe(true);
    });

    it('should generate canonical Pipeline 2 DB-Templating preset with 60fps and chart curves', () => {
      const config = DirectorPresetFactory.createForArchetype('2');

      expect(config.fps).toBe(60);
      expect(config.aspectRatio).toBe('16:9');
      expect(config.typography?.preset).toBe('bold_headline');
      expect(config.archetypeDirectives?.chartVisuals?.animationCurve).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
      expect(config.archetypeDirectives?.chartVisuals?.glowIntensity).toBe(0.6);
      expect(config.roleDirectives?.hook?.sfxCues?.[0].sfxType).toBe('impact_bass');
    });

    it('should generate canonical Pipeline 3 Repurposing preset with talking head directives', () => {
      const config = DirectorPresetFactory.createForArchetype('repurposing-recycler');

      expect(config.aspectRatio).toBe('9:16');
      expect(config.typography?.preset).toBe('tiktok_karaoke_glow');
      expect(config.archetypeDirectives?.talkingHead?.autoReframe).toBe('center_face');
      expect(config.archetypeDirectives?.talkingHead?.punchInOnEmphasis).toBe(true);
      expect(config.roleDirectives?.hook?.cameraMotion?.type).toBe('dolly_zoom');
      expect(config.roleDirectives?.hook?.sfxCues?.[0].sfxType).toBe('whoosh');
    });

    it('should generate canonical Pipeline 4 Generative Story preset with 3D Depth & Teal-Orange LUT', () => {
      const config = DirectorPresetFactory.createForArchetype('generative-storytelling');

      expect(config.canvas?.colorGrading?.lutPreset).toBe('cinematic_teal_orange');
      expect(config.typography?.preset).toBe('3d_sandwich');
      expect(config.archetypeDirectives?.narrativeStory?.cinematicBars).toBe(true);
      expect(config.archetypeDirectives?.narrativeStory?.ambientDustParticles).toBe(true);
      expect(config.roleDirectives?.hook?.depth3d?.mode).toBe('sandwich');
      expect(config.roleDirectives?.hook?.depth3d?.enabled).toBe(true);
      expect(config.roleDirectives?.hook?.transition?.type).toBe('crossfade');
    });

    it('should generate canonical Pipeline 5 Rule-Logic preset with glitch transitions', () => {
      const config = DirectorPresetFactory.createForArchetype('rule-logic');

      expect(config.canvas?.colorGrading?.lutPreset).toBe('cyberpunk_neon');
      expect(config.roleDirectives?.hook?.transition?.type).toBe('glitch');
      expect(config.roleDirectives?.hook?.sfxCues?.[0].sfxType).toBe('notification');
    });

    it('should generate canonical Pipeline 6 Ambient Loop preset with continuous BGM', () => {
      const config = DirectorPresetFactory.createForArchetype('ambient-loops');

      expect(config.canvas?.colorGrading?.lutPreset).toBe('warm_golden');
      expect(config.audioStaging?.autoDucking).toBe(false);
      expect(config.audioStaging?.masterBgmVolume).toBe(0.85);
      expect(config.roleDirectives?.hook?.cameraMotion?.type).toBe('pan_left');
      expect(config.roleDirectives?.hook?.transition?.durationMs).toBe(1200);
    });

    it('should honor custom AutoScaffoldOptions overrides across presets', () => {
      const customConfig = DirectorPresetFactory.createForArchetype('4', undefined, {
        aspectRatio: '1:1',
        fps: 24,
        enableDepth3D: false,
        enableTransitions: false,
      });

      expect(customConfig.aspectRatio).toBe('1:1');
      expect(customConfig.canvas?.aspectRatio).toBe('1:1');
      expect(customConfig.fps).toBe(24);
      expect(customConfig.roleDirectives?.hook?.depth3d?.enabled).toBe(false);
      expect(customConfig.roleDirectives?.hook?.transition?.type).toBe('none');
      expect(customConfig.roleDirectives?.hook?.transition?.durationMs).toBe(0);
    });
  });
});
