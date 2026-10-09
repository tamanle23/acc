import type {
  ExtendedPipelineIR,
  ExtendedContentChunk,
  VisualLayer,
  TypographyOverlay,
  AudioTrackSpec,
  PlatformPreset,
  PipelineId
} from './PipelineIR';

export interface LegacySceneConfig {
  image?: string;
  video?: string;
  audio?: string;
  text?: string;
  duration?: number;
  captions?: Array<{
    text: string;
    start: number;
    end: number;
  }>;
  transition?: {
    enabled?: boolean;
    type?: string;
    duration?: number;
  };
  depth3d?: {
    enabled?: boolean;
    mode?: string;
    frameStyle?: string;
  };
}

export interface LegacyStorySettings {
  width?: number;
  height?: number;
  fps?: number;
  platform?: string;
  overlayComposite?: string;
  bgm?: {
    source: string;
    volume?: number;
    loop?: boolean;
    autoDucking?: boolean;
  };
}

export interface LegacyStoryConfig {
  name?: string;
  description?: string;
  settings?: LegacyStorySettings;
  scenes?: LegacySceneConfig[];
  slides?: LegacySceneConfig[]; // backward compatibility
}

export class LegacyStoryConfigAdapter {
  public static adapt(legacyConfig: LegacyStoryConfig, jobId = `job_${Date.now()}`): ExtendedPipelineIR {
    const settings = legacyConfig.settings || {};
    const rawScenes = legacyConfig.scenes || legacyConfig.slides || [];

    const width = settings.width || 1080;
    const height = settings.height || 1920;
    const fps = settings.fps || 30;
    const platform = (settings.platform as PlatformPreset) || 'tiktok';

    const extendedChunks: ExtendedContentChunk[] = rawScenes.map((scene, index) => {
      const chunkId = `chunk_${index + 1}`;
      const visualSource = scene.video || scene.image || '';
      const visualLayers: VisualLayer[] = [];

      if (visualSource) {
        visualLayers.push({
          id: `layer_${chunkId}_base`,
          layerIndex: 0,
          type: scene.video ? 'video' : 'image',
          sourcePathOrBuffer: visualSource,
          transform: {
            position: { x: width / 2, y: height / 2 },
            scale: { x: 1.0, y: 1.0 },
            rotationDeg: 0,
            opacity: 1.0,
          },
        });
      }

      const typographyOverlays: TypographyOverlay[] = [];
      if (scene.captions && scene.captions.length > 0) {
        for (let cIdx = 0; cIdx < scene.captions.length; cIdx++) {
          const cap = scene.captions[cIdx];
          typographyOverlays.push({
            id: `caption_${chunkId}_${cIdx}`,
            type: 'dynamic_caption',
            text: cap.text,
            startMs: Math.round(cap.start * 1000),
            durationMs: Math.round((cap.end - cap.start) * 1000),
            stylePreset: platform === 'tiktok' ? 'tiktok' : 'classic',
          });
        }
      }

      // Estimate scene duration in ms
      let sceneDurationMs = Math.round((scene.duration || 5) * 1000);
      if (scene.captions && scene.captions.length > 0) {
        const lastCaptionEnd = Math.max(...scene.captions.map(c => c.end));
        sceneDurationMs = Math.max(sceneDurationMs, Math.round(lastCaptionEnd * 1000));
      }

      return {
        id: chunkId,
        order: index,
        text: scene.text,
        spokenAudioPath: scene.audio,
        durationMs: sceneDurationMs,
        videoOffsetMs: (scene as any).videoOffsetMs,
        audioOffsetMs: (scene as any).audioOffsetMs,
        visualLayers,
        typographyOverlays,
        transitionToNext: scene.transition?.enabled ? {
          type: scene.transition.type || 'fade',
          durationMs: Math.round((scene.transition.duration || 1) * 1000),
          audioBehavior: 'crossfade',
        } : undefined,
      };
    });

    const audioTracks: AudioTrackSpec[] = [];
    if (settings.bgm?.source) {
      audioTracks.push({
        id: 'track_bgm_1',
        type: 'bgm',
        sourcePath: settings.bgm.source,
        startMs: 0,
        durationMs: extendedChunks.reduce((acc, c) => acc + c.durationMs, 0),
        volume: settings.bgm.volume ?? 0.15,
      });
    }

    return {
      schemaVersion: '3.1.0',
      pipelineId: 'generative-storytelling' as PipelineId,
      metadata: {
        jobId,
        title: legacyConfig.name || 'Adapted Story',
        createdAt: new Date().toISOString(),
        tags: ['adapted', 'legacy-v3.0'],
      },
      settings: {
        resolution: { width, height },
        fps,
        platform,
        colorSpace: 'rec709',
        targetLoudnessLufs: -14,
      },
      chunks: extendedChunks.map(c => ({
        id: c.id,
        order: c.order,
        text: c.text,
        spokenAudioPath: c.spokenAudioPath,
        durationMs: c.durationMs,
        visualAsset: c.visualLayers.length > 0 ? {
          type: c.visualLayers[0].type === 'video' ? 'video' : 'image',
          sourcePathOrBuffer: c.visualLayers[0].sourcePathOrBuffer,
          resolution: { width, height },
        } : undefined,
      })),
      audioComposition: {
        backgroundMusic: settings.bgm?.source ? {
          audioPath: settings.bgm.source,
          volume: settings.bgm.volume ?? 0.15,
          loop: settings.bgm.loop ?? true,
        } : undefined,
        sfxMarkers: [],
        ducking: {
          enabled: settings.bgm?.autoDucking ?? true,
          attenuationDb: -18,
          attackMs: 20,
          releaseMs: 250,
        },
      },
      distributionHints: {
        supportedExporters: ['video'],
        targetAspectRatios: [width < height ? '9:16' : '16:9'],
      },
      extendedChunks,
      audioTracks,
    };
  }
}
