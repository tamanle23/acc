import type {
  VideoIRDocument,
  IRTrack,
  IRSequence,
  AssetDefinition,
  ModifierNode,
} from '../types/VideoIR';
import type { LegacyStoryConfig, LegacySceneConfig } from './LegacyStoryConfigAdapter';

import type { IConfigToIRAdapter, AdapterOptions } from './IConfigToIRAdapter';

/**
 * StoryConfigToUniversalIRAdapter:
 * Bridges existing story_config.json / LegacyStoryConfig formats into
 * canonical V1.0-Stable Video IR documents.
 * Establishes the pioneer end-to-end verification baseline.
 */
export class StoryConfigToUniversalIRAdapter implements IConfigToIRAdapter<LegacyStoryConfig> {
  public readonly id = 'story-config-pioneer';
  public readonly name = 'Legacy StoryConfig Pioneer Adapter';
  public readonly version = '1.0.0';

  public canAdapt(config: unknown): boolean {
    if (!config || typeof config !== 'object') return false;
    const c = config as Record<string, unknown>;
    return Boolean(
      (c.scenes && Array.isArray(c.scenes)) ||
      (c.slides && Array.isArray(c.slides)) ||
      (c.settings && typeof c.settings === 'object')
    );
  }

  public adapt(legacyConfig: LegacyStoryConfig, options?: AdapterOptions): VideoIRDocument {
    return StoryConfigToUniversalIRAdapter.adapt(legacyConfig, options?.contentId);
  }

  public static adapt(legacyConfig: LegacyStoryConfig, contentId = `story_${Date.now()}`): VideoIRDocument {
    const settings = legacyConfig.settings || {};
    const rawScenes: LegacySceneConfig[] = legacyConfig.scenes || legacyConfig.slides || [];

    const fps = settings.fps || 30;
    const width = settings.width || 1920;
    const height = settings.height || 1080;

    const assets: Record<string, AssetDefinition> = {};
    const videoSequences: IRSequence[] = [];
    const audioSequences: IRSequence[] = [];
    const captionSequences: IRSequence[] = [];

    rawScenes.forEach((scene, index) => {
      const sceneId = `seq_${index + 1}`;
      const visualAssetId = `asset_vis_${index + 1}`;
      const audioAssetId = `asset_aud_${index + 1}`;

      const visualSrc = scene.video || scene.image || '';
      const audioSrc = scene.audio || '';

      if (visualSrc) {
        assets[visualAssetId] = {
          src: visualSrc,
          type: scene.video ? 'media' : 'image',
        };
      }

      if (audioSrc) {
        assets[audioAssetId] = {
          src: audioSrc,
          type: 'audio',
        };
      }

      // 1. Audio Voiceover Anchor Sequence
      const audioSeqId = `${sceneId}_vo`;
      if (audioSrc) {
        audioSequences.push({
          id: audioSeqId,
          assetId: audioAssetId,
          time: {
            start: index === 0 ? 0 : { after: `seq_${index}_vo` },
            duration: scene.duration ? Math.round(scene.duration * fps) : { matchAssetDuration: true },
          },
        });
      }

      // 2. Video Visual Sequence (Subordinated to audio anchor or previous video)
      const videoModifiers: ModifierNode[] = [];
      if (scene.depth3d?.enabled || scene.depth3d?.mode) {
        videoModifiers.push({
          type: 'vfx/depth3d',
          params: {
            mode: scene.depth3d.mode || 'frame_breaker',
            frameStyle: scene.depth3d.frameStyle,
          },
        });
      }

      if (scene.transition?.enabled) {
        videoModifiers.push({
          type: 'transition/crossfade',
          params: {
            durationFrames: Math.round((scene.transition.duration || 1.0) * fps),
            overlapTarget: index > 0 ? `seq_${index}_vis` : undefined,
          },
        });
      }

      const videoSeqId = `${sceneId}_vis`;
      videoSequences.push({
        id: videoSeqId,
        assetId: visualSrc ? visualAssetId : undefined,
        time: {
          start: audioSrc ? { syncWith: audioSeqId } : index === 0 ? 0 : { after: `seq_${index}_vis` },
          duration: audioSrc ? { matchLengthOf: audioSeqId } : Math.round((scene.duration || 5.0) * fps),
        },
        modifiers: videoModifiers.length > 0 ? videoModifiers : undefined,
      });

      // 3. Timed Text Captions Sequence
      if (scene.captions && scene.captions.length > 0) {
        const captionSeqId = `${sceneId}_cap`;
        captionSequences.push({
          id: captionSeqId,
          time: {
            start: { syncWith: audioSeqId },
            duration: { matchLengthOf: audioSeqId },
          },
          cues: scene.captions.map(c => ({
            startOffsetMs: Math.round(c.start * 1000),
            endOffsetMs: Math.round(c.end * 1000),
            text: c.text,
          })),
        });
      }
    });

    const tracks: IRTrack[] = [];

    // Track V1: Main Video
    tracks.push({
      id: 'track_v1_main',
      type: 'video',
      sequences: videoSequences,
    });

    // Track A1: Voiceover Anchor
    if (audioSequences.length > 0) {
      tracks.push({
        id: 'track_a1_voiceover',
        type: 'audio',
        sequences: audioSequences,
      });
    }

    // Track Captions
    if (captionSequences.length > 0) {
      tracks.push({
        id: 'track_captions',
        type: 'timed_text',
        style: settings.captions ? (settings.captions as unknown as Record<string, unknown>) : undefined,
        sequences: captionSequences,
      });
    }

    // Track A2: Background Music (BGM with Dynamic Ducking)
    if (settings.bgm?.source) {
      const bgmAssetId = 'asset_bgm';
      assets[bgmAssetId] = {
        src: settings.bgm.source,
        type: 'audio',
      };

      const bgmModifiers: ModifierNode[] = [];
      if (settings.bgm.autoDucking && audioSequences.length > 0) {
        bgmModifiers.push({
          type: 'sfx/dynamic_ducking',
          params: {
            controlTrackId: 'track_a1_voiceover',
            attenuationDb: -16.0,
            attackMs: 25,
            releaseMs: 500,
          },
        });
      }

      tracks.push({
        id: 'track_a2_bgm',
        type: 'audio',
        modifiers: bgmModifiers.length > 0 ? bgmModifiers : undefined,
        sequences: [
          {
            id: 'seq_bgm_main',
            assetId: bgmAssetId,
            time: {
              start: 0,
              duration: { matchLengthOf: 'seq_1_vis' }, // stretched during DAG solve across all video
            },
          },
        ],
      });
    }

    return {
      version: '1.0.0-stable',
      meta: {
        contentId: legacyConfig.name || contentId,
        globalFps: fps,
        canvasSize: { w: width, h: height },
      },
      assets,
      tracks,
    };
  }
}
