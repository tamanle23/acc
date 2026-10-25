import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';
import {
  AutoConfigLegacyBridgeAdapter,
  PipelineIRBuilder,
  DirectorPresetFactory,
  type StoryConfig,
} from '@acc/core';

describe('Universal Auto-Config Phase 4: Legacy Bridge Adapter', () => {
  describe('toStoryConfig Conversion', () => {
    it('should map PipelineIR and DirectorPreset to a valid StoryConfig with 9:16 TikTok layout', () => {
      const builder = new PipelineIRBuilder('generative-storytelling')
        .setTitle('Neon Tokyo Tale')
        .setAudioComposition({
          backgroundMusic: { audioPath: 'audio/bgm.mp3', volume: 0.3, loop: true },
          ducking: { enabled: true, attenuationDb: -14, attackMs: 200, releaseMs: 350 },
        })
        .addChunk({
          id: 'chunk-1',
          order: 1,
          text: 'Scene 1 in the rain',
          spokenAudioPath: 'audio/01.wav',
          durationMs: 3500,
          visualAsset: {
            type: 'image',
            sourcePathOrBuffer: 'images/01.png',
            resolution: { width: 1080, height: 1920 },
          },
        })
        .addChunk({
          id: 'chunk-2',
          order: 2,
          text: 'Scene 2 in the club',
          spokenAudioPath: 'audio/02.wav',
          durationMs: 4200,
          visualAsset: {
            type: 'video',
            sourcePathOrBuffer: 'videos/02.mp4',
            resolution: { width: 1080, height: 1920 },
          },
        });

      const ir = builder.build();
      const directorConfig = DirectorPresetFactory.createForArchetype('4', undefined, {
        aspectRatio: '9:16',
        fps: 30,
      });

      const storyConfig = AutoConfigLegacyBridgeAdapter.toStoryConfig(ir, directorConfig);

      expect(storyConfig.name).toBe('Neon Tokyo Tale');
      expect(storyConfig.settings.width).toBe(1080);
      expect(storyConfig.settings.height).toBe(1920);
      expect(storyConfig.settings.platform).toBe('tiktok');
      expect(storyConfig.settings.fps).toBe(30);
      expect(storyConfig.settings.bgm?.source).toBe('audio/bgm.mp3');
      expect(storyConfig.settings.bgm?.autoDucking).toBe(true);

      // Verify scenes mapping
      expect(storyConfig.scenes?.length).toBe(2);

      const scene1 = storyConfig.scenes![0];
      expect(scene1.text).toBe('Scene 1 in the rain');
      expect(scene1.audio).toBe('audio/01.wav');
      expect(scene1.image).toBe('images/01.png');
      expect(scene1.video).toBeUndefined();
      expect(scene1.duration).toBe(3.5); // 3500ms -> 3.5s

      const scene2 = storyConfig.scenes![1];
      expect(scene2.text).toBe('Scene 2 in the club');
      expect(scene2.audio).toBe('audio/02.wav');
      expect(scene2.video).toBe('videos/02.mp4');
      expect(scene2.image).toBeUndefined();
      expect(scene2.duration).toBe(4.2); // 4200ms -> 4.2s
    });

    it('should map 16:9 YouTube resolution and 60fps for Pipeline 2 (DB-Templating)', () => {
      const builder = new PipelineIRBuilder('db-templating')
        .setTitle('Crypto Leaderboard')
        .addChunk({ id: 'c1', order: 1, durationMs: 5000 });

      const ir = builder.build();
      const directorConfig = DirectorPresetFactory.createForArchetype('2');

      const storyConfig = AutoConfigLegacyBridgeAdapter.toStoryConfig(ir, directorConfig);

      expect(storyConfig.settings.width).toBe(1920);
      expect(storyConfig.settings.height).toBe(1080);
      expect(storyConfig.settings.platform).toBe('youtube');
      expect(storyConfig.settings.fps).toBe(60);
      expect(storyConfig.settings.captions?.preset).toBe('bold-retro');
    });

    it('should map 3D depth and typography settings cleanly', () => {
      const builder = new PipelineIRBuilder('generative-storytelling')
        .setTitle('Depth Test')
        .addChunk({ id: 'c1', order: 1, durationMs: 3000 });

      const ir = builder.build();
      const directorConfig = DirectorPresetFactory.createForArchetype('4', undefined, {
        enableDepth3D: true,
      });

      const storyConfig = AutoConfigLegacyBridgeAdapter.toStoryConfig(ir, directorConfig);

      expect(storyConfig.settings.depth3d?.enabled).toBe(true);
      expect(storyConfig.settings.depth3d?.mode).toBe('volumetric_sandwich');
      expect(storyConfig.settings.depth3d?.sandwich?.textBehindSubject).toBe(true);
      expect(storyConfig.settings.captions?.preset).toBe('cinematic');
    });
  });

  describe('fromStoryConfig Reverse Conversion', () => {
    it('should convert a legacy StoryConfig into a valid PipelineIR and DirectorConfig', () => {
      const legacyConfig: StoryConfig = {
        name: 'Classic Dinosaur Tale',
        settings: {
          width: 1920,
          height: 1080,
          fps: 30,
          bgm: {
            source: 'assets/bgm.mp3',
            volume: 0.15,
            loop: true,
            autoDucking: true,
          },
          captions: {
            primaryColor: '#FFFF00',
            highlightColor: '#00FFFF',
          },
        },
        scenes: [
          {
            image: 'assets/scene1.jpg',
            audio: 'audio/scene1.wav',
            text: 'Long ago in the jurassic...',
            duration: 4.5,
          },
          {
            video: 'assets/scene2.mp4',
            audio: 'audio/scene2.wav',
            text: 'A giant rex appeared...',
            duration: 6.0,
          },
        ],
      };

      const { pipelineIR, directorConfig } = AutoConfigLegacyBridgeAdapter.fromStoryConfig(legacyConfig);

      expect(pipelineIR.schemaVersion).toBe('3.0.0');
      expect(pipelineIR.metadata.title).toBe('Classic Dinosaur Tale');
      expect(pipelineIR.chunks.length).toBe(2);

      expect(pipelineIR.chunks[0].text).toBe('Long ago in the jurassic...');
      expect(pipelineIR.chunks[0].durationMs).toBe(4500);
      expect(pipelineIR.chunks[0].visualAsset?.type).toBe('image');
      expect(pipelineIR.chunks[0].visualAsset?.sourcePathOrBuffer).toBe('assets/scene1.jpg');

      expect(pipelineIR.chunks[1].text).toBe('A giant rex appeared...');
      expect(pipelineIR.chunks[1].durationMs).toBe(6000);
      expect(pipelineIR.chunks[1].visualAsset?.type).toBe('video');
      expect(pipelineIR.chunks[1].visualAsset?.sourcePathOrBuffer).toBe('assets/scene2.mp4');

      expect(pipelineIR.audioComposition.backgroundMusic?.audioPath).toBe('assets/bgm.mp3');
      expect(pipelineIR.audioComposition.backgroundMusic?.volume).toBe(0.15);

      expect(directorConfig.aspectRatio).toBe('16:9');
      expect(directorConfig.fps).toBe(30);
      expect(directorConfig.typography?.primaryColor).toBe('#FFFF00');
    });
  });

  describe('Golden Master Parity with Real sample-story', () => {
    it('should bidirectional-bridge sample-story/story-config.json with zero schema degradation', () => {
      const sampleStoryPath = path.resolve('sample-story/story-config.json');
      expect(fs.existsSync(sampleStoryPath)).toBe(true);

      const rawContent = fs.readFileSync(sampleStoryPath, 'utf-8');
      const sampleConfig = JSON.parse(rawContent) as StoryConfig;

      // Convert to PipelineIR
      const { pipelineIR, directorConfig } = AutoConfigLegacyBridgeAdapter.fromStoryConfig(sampleConfig);

      expect(pipelineIR.chunks.length).toBe(sampleConfig.scenes?.length);
      expect(pipelineIR.metadata.title).toBe(sampleConfig.name!);

      // Convert back to StoryConfig
      const bridgedStoryConfig = AutoConfigLegacyBridgeAdapter.toStoryConfig(pipelineIR, directorConfig);

      expect(bridgedStoryConfig.name).toBe(sampleConfig.name);
      expect(bridgedStoryConfig.scenes?.length).toBe(sampleConfig.scenes?.length);

      // Verify each scene maintained its media bindings and durations
      for (let i = 0; i < (sampleConfig.scenes || []).length; i++) {
        const originalScene = sampleConfig.scenes![i];
        const bridgedScene = bridgedStoryConfig.scenes![i];

        if (originalScene.image) {
          expect(bridgedScene.image).toBe(originalScene.image);
        }
        if (originalScene.audio) {
          expect(bridgedScene.audio).toBe(originalScene.audio);
        }
        expect(bridgedScene.duration).toBe(originalScene.duration);
      }
    });
  });
});
