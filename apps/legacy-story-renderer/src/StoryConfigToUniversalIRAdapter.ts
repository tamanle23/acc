import type {
  VideoIRDocument,
  IRTrack,
  IRSequence,
  AssetDefinition,
  ModifierNode,
  LegacyStoryConfig,
  LegacySceneConfig,
  IConfigToIRAdapter,
  AdapterOptions,
} from '@acc/ir';

/**
 * StoryConfigToUniversalIRAdapter:
 * Bridges existing story_config.json / LegacyStoryConfig formats into
 * canonical V1.0-Stable Video IR documents.
 * Establishes the pioneer end-to-end verification baseline.
 *
 * @deprecated Legacy story_config.json is deprecated in favor of pipeline-ir.json.
 * For modern omnichannel pipelines, use `PipelineIRToUniversalIRAdapter`.
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
    return StoryConfigToUniversalIRAdapter.adapt(legacyConfig, options?.contentId, options?.baseDir as string | undefined);
  }

  public static adapt(
    legacyConfig: LegacyStoryConfig,
    contentId = `story_${Date.now()}`,
    baseDir?: string
  ): VideoIRDocument {
    const settings = legacyConfig.settings || {};
    const rawScenes: LegacySceneConfig[] = legacyConfig.scenes || legacyConfig.slides || [];

    const fps = settings.fps || 30;
    const width = settings.width || 1920;
    const height = settings.height || 1080;

    const assets: Record<string, AssetDefinition> = {};
    const videoSequences: IRSequence[] = [];
    const audioSequences: IRSequence[] = [];
    const captionSequences: IRSequence[] = [];

    const resolvePath = (p: string | undefined): string => {
      if (!p) return '';
      const isAbsolute = p.startsWith('/') || p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:') || p.startsWith('blob:') || Boolean(p.match(/^[a-zA-Z]:[\\/]/));
      if (!baseDir || isAbsolute) return p;
      const trimmedBase = baseDir.endsWith('/') || baseDir.endsWith('\\') ? baseDir : `${baseDir}/`;
      return `${trimmedBase}${p}`;
    };

    rawScenes.forEach((scene, index) => {
      const sceneId = `seq_${index + 1}`;
      const visualAssetId = `asset_vis_${index + 1}`;
      const audioAssetId = `asset_aud_${index + 1}`;

      const rawVisualSrc = (scene as any).resolvedVideo || (scene as any).resolvedImage || scene.video || scene.image || '';
      const rawAudioSrc = (scene as any).resolvedAudio || scene.audio || '';

      const visualSrc = resolvePath(rawVisualSrc);
      const audioSrc = resolvePath(rawAudioSrc);

      if (visualSrc) {
        assets[visualAssetId] = {
          src: visualSrc,
          type: (scene.video || (scene as any).resolvedVideo) ? 'media' : 'image',
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
      const pauseSec = scene.pauseAfter !== undefined ? scene.pauseAfter : (settings.pauseBetweenScenes || 0);
      const pauseFrames = Math.round(pauseSec * fps);

      if (audioSrc) {
        audioSequences.push({
          id: audioSeqId,
          type: 'audio',
          assetId: audioAssetId,
          time: {
            start: index === 0 ? 0 : { after: `seq_${index}_vo`, offsetFrames: pauseFrames },
            duration: scene.duration ? Math.round(scene.duration * fps) : { matchAssetDuration: true },
          },
        });
      }

      // 2. Video Visual Sequence (Subordinated to audio anchor or previous video)
      const videoModifiers: ModifierNode[] = [];
      if (scene.depth3d?.enabled || scene.depth3d?.mode) {
        videoModifiers.push({
          type: 'vfx/depth3d',
          target: ['video', 'image'],
          params: {
            ...scene.depth3d,
            mode: scene.depth3d.mode || 'frame_breaker',
            imagePath: visualSrc,
            captions: scene.captions,
          },
        });
      }

      if ((scene as any).camera3d) {
        videoModifiers.push({
          type: 'vfx/camera_3d',
          target: ['video', 'image', 'overlay'],
          params: (scene as any).camera3d,
        });
      }

      if ((scene as any).particleOverlay) {
        videoModifiers.push({
          type: 'overlay/canvas_particles',
          target: ['video', 'overlay'],
          params: (scene as any).particleOverlay,
        });
      }

      // Step D1: Forward Color Grading / LUT modifier
      const colorGrading = (scene as any).colorGrading || (settings as any).colorGrading;
      if (colorGrading) {
        videoModifiers.push({
          type: 'vfx/color_grading',
          target: ['video', 'image', 'overlay'],
          params: {
            lutPath: resolvePath(colorGrading.lutPath || colorGrading.lut),
            contrast: colorGrading.contrast ?? 1.05,
            saturation: colorGrading.saturation ?? 1.1,
          },
        });
      }

      const transitionConfig = scene.transition || (settings.transition?.enabled ? settings.transition : undefined);
      let transitionDurationFrames = 0;
      if (transitionConfig?.enabled) {
        transitionDurationFrames = Math.round((transitionConfig.duration || 1.0) * fps);
        videoModifiers.push({
          type: 'transition/crossfade',
          target: ['video', 'image', 'overlay'],
          params: {
            durationFrames: transitionDurationFrames,
            overlapTarget: index > 0 ? `seq_${index}_vis` : undefined,
          },
        });
      }

      const videoSeqId = `${sceneId}_vis`;
      // Step D1: Forward J/L-cut offset timing (videoOffsetMs / audioOffsetMs)
      const videoOffsetFrames = (scene as any).videoOffsetMs ? Math.round(((scene as any).videoOffsetMs / 1000) * fps) : 0;

      // When transition overlap is active on incoming scene (index > 0), overlap with previous scene
      const overlapFrames = (index > 0 && transitionDurationFrames > 0) ? transitionDurationFrames : 0;

      videoSequences.push({
        id: videoSeqId,
        type: (scene.video || (scene as any).resolvedVideo) ? 'video' : 'image',
        assetId: visualSrc ? visualAssetId : undefined,
        time: {
          start: audioSrc
            ? (videoOffsetFrames !== 0
                ? { syncWith: audioSeqId, offsetFrames: videoOffsetFrames }
                : (overlapFrames > 0
                    ? { after: `seq_${index}_vis`, overlapFrames }
                    : { syncWith: audioSeqId }))
            : (index === 0
                ? 0
                : (overlapFrames > 0
                    ? { after: `seq_${index}_vis`, overlapFrames }
                    : { after: `seq_${index}_vis` })),
          duration: audioSrc
            ? (pauseFrames > 0
                ? { matchLengthOf: audioSeqId, paddingFrames: pauseFrames + overlapFrames }
                : (overlapFrames > 0
                    ? { matchLengthOf: audioSeqId, paddingFrames: overlapFrames }
                    : { matchLengthOf: audioSeqId }))
            : Math.round(((scene.duration || 5.0) + pauseSec) * fps) + overlapFrames,
        },
        modifiers: videoModifiers.length > 0 ? videoModifiers : undefined,
      });

      // 3. Timed Text Captions Sequence
      if (scene.captions && scene.captions.length > 0) {
        const captionSeqId = `${sceneId}_cap`;
        captionSequences.push({
          id: captionSeqId,
          type: 'text',
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

    // Track V1: Main Video (with Track-level Overlay Modifiers if configured)
    const videoTrackModifiers: ModifierNode[] = [];
    if (settings.overlayComposite) {
      const comp = settings.overlayComposite.toLowerCase();
      let particleType: 'rain' | 'snow' | 'dust' | 'embers' | 'light_leak' | 'vhs' = 'dust';
      if (comp.includes('rain')) particleType = 'rain';
      else if (comp.includes('snow') || comp.includes('blizzard')) particleType = 'snow';
      else if (comp.includes('ember') || comp.includes('fire')) particleType = 'embers';
      else if (comp.includes('leak') || comp.includes('sun')) particleType = 'light_leak';
      else if (comp.includes('vhs') || comp.includes('retro')) particleType = 'vhs';

      videoTrackModifiers.push({
        type: 'overlay/canvas_particles',
        target: ['video', 'overlay'],
        params: {
          type: particleType,
          variant: comp,
          intensity: 1.0,
          opacity: 0.65,
        },
      });
    }

    tracks.push({
      id: 'track_v1_main',
      type: 'video',
      modifiers: videoTrackModifiers.length > 0 ? videoTrackModifiers : undefined,
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

    // Track Captions (Forward safe-zone platform)
    if (captionSequences.length > 0) {
      const captionStyle = settings.captions ? { ...settings.captions } : {};
      if (settings.platform) {
        (captionStyle as any).platform = settings.platform;
      }

      tracks.push({
        id: 'track_captions',
        type: 'timed_text',
        style: captionStyle as Record<string, unknown>,
        sequences: captionSequences,
      });
    }

    // Track A3: Sound Effects (SFX) Track
    const sfxSequences: IRSequence[] = [];
    rawScenes.forEach((scene, index) => {
      const sfxClips = (scene as any).sfx;
      if (sfxClips && Array.isArray(sfxClips)) {
        sfxClips.forEach((clip: any, cIdx: number) => {
          if (clip.source) {
            const sfxAssetId = `asset_sfx_${index + 1}_${cIdx + 1}`;
            const sfxSrc = resolvePath(clip.source);
            assets[sfxAssetId] = {
              src: sfxSrc,
              type: 'audio',
            };
            sfxSequences.push({
              id: `seq_sfx_${index + 1}_${cIdx + 1}`,
              type: 'audio',
              assetId: sfxAssetId,
              time: {
                start: { syncWith: `seq_${index + 1}_vo`, offsetFrames: Math.round((clip.time || 0) * fps) },
                duration: clip.duration ? Math.round(clip.duration * fps) : { matchAssetDuration: true },
              },
            });
          }
        });
      }
    });

    if (sfxSequences.length > 0) {
      tracks.push({
        id: 'track_a3_sfx',
        type: 'audio',
        sequences: sfxSequences,
      });
    }

    // Track A2: Background Music (BGM with Dynamic Ducking)
    if (settings.bgm?.source) {
      const bgmAssetId = 'asset_bgm';
      assets[bgmAssetId] = {
        src: resolvePath(settings.bgm.source),
        type: 'audio',
      };

      const bgmModifiers: ModifierNode[] = [];
      if (settings.bgm.autoDucking && audioSequences.length > 0) {
        bgmModifiers.push({
          type: 'sfx/dynamic_ducking',
          target: 'audio',
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
            type: 'audio',
            assetId: bgmAssetId,
            time: {
              start: 0,
              duration: { matchLengthOf: 'timeline' },
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
