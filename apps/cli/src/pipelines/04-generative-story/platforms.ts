import { execSync } from 'child_process';
import { FFmpegManager } , Logger } from '@acc/core';
import os from 'os';
import type {
  PlatformPreset,
  StorySettings,
  ResolvedStorySettings,
  VideoCodec,
  AudioCodec,
  ContainerFormat,
  GpuAcceleration,
  CaptionSettings,
  UpscaleSettings,
  BGMSettings,
  TransitionSettings,
  Depth3DConfig,
  TtsConfig,
  VideoSettings,
  AudioTrackConfig,
  SFXClipConfig,
} from '@acc/core';


export interface PlatformConfigDefaults {
  width: number;
  height: number;
  fps: number;
  container: ContainerFormat;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  audioBitrate: string;
  crf: number;
  preset: string;
  pixelFormat: string;
  fastStart: boolean;
  gpuAcceleration: GpuAcceleration;
  concurrency: number | 'auto';
  captions: CaptionSettings;
}

export const PLATFORM_PRESETS: Record<PlatformPreset, PlatformConfigDefaults> = {
  tiktok: {
    width: 1080,
    height: 1920, // 9:16 vertical
    fps: 30,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    audioBitrate: '192k',
    crf: 21,
    preset: 'p4',
    pixelFormat: 'yuv420p',
    fastStart: true,
    gpuAcceleration: 'auto',
    concurrency: 'auto',
    captions: {
      preset: 'tiktok',
      subtitleMode: 'burn',
      position: 'bottom',
      wordsPerPhrase: 3,
      fontSize: 50,
      marginV: 280, // Optimized for TikTok UI safe zone (above title/sound disk)
      marginH: 60,
    },
  },
  shorts: {
    width: 1080,
    height: 1920, // 9:16 vertical
    fps: 30,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    audioBitrate: '192k',
    crf: 21,
    preset: 'p4',
    pixelFormat: 'yuv420p',
    fastStart: true,
    gpuAcceleration: 'auto',
    concurrency: 'auto',
    captions: {
      preset: 'tiktok',
      subtitleMode: 'burn',
      position: 'bottom',
      wordsPerPhrase: 3,
      fontSize: 50,
      marginV: 280, // Above YouTube Shorts engagement UI
      marginH: 60,
    },
  },
  reels: {
    width: 1080,
    height: 1920, // 9:16 vertical
    fps: 30,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    audioBitrate: '192k',
    crf: 21,
    preset: 'p4',
    pixelFormat: 'yuv420p',
    fastStart: true,
    gpuAcceleration: 'auto',
    concurrency: 'auto',
    captions: {
      preset: 'tiktok',
      subtitleMode: 'burn',
      position: 'bottom',
      fontSize: 50,
      marginV: 280, // Above Instagram/FB Reels description
      marginH: 60,
    },
  },
  youtube: {
    width: 1920,
    height: 1080, // 16:9 landscape 1080p
    fps: 30,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    audioBitrate: '256k',
    crf: 20,
    preset: 'p4',
    pixelFormat: 'yuv420p',
    fastStart: true,
    gpuAcceleration: 'auto',
    concurrency: 'auto',
    captions: {
      preset: 'classic',
      subtitleMode: 'burn',
      position: 'bottom',
      fontSize: 44,
      marginV: 65, // Clears YouTube bottom progress bar
      marginH: 80,
    },
  },
  'youtube-4k': {
    width: 3840,
    height: 2160, // 16:9 4K
    fps: 60,
    container: 'mp4',
    videoCodec: 'h265',
    audioCodec: 'aac',
    audioBitrate: '320k',
    crf: 18,
    preset: 'p4',
    pixelFormat: 'yuv420p',
    fastStart: true,
    gpuAcceleration: 'auto',
    concurrency: 'auto',
    captions: {
      preset: 'classic',
      subtitleMode: 'burn',
      position: 'bottom',
      fontSize: 88, // Scaled for 4K canvas
      outlineSize: 6,
      shadowSize: 4,
      marginV: 130,
      marginH: 160,
    },
  },
  facebook: {
    width: 1080,
    height: 1350, // 4:5 portrait
    fps: 30,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    audioBitrate: '192k',
    crf: 22,
    preset: 'p4',
    pixelFormat: 'yuv420p',
    fastStart: true,
    gpuAcceleration: 'auto',
    concurrency: 'auto',
    captions: {
      preset: 'vlog',
      subtitleMode: 'burn',
      position: 'bottom',
      fontSize: 46,
      marginV: 80, // Optimal for Facebook News Feed scrolling
      marginH: 50,
    },
  },
  instagram: {
    width: 1080,
    height: 1080, // 1:1 square
    fps: 30,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    audioBitrate: '192k',
    crf: 21,
    preset: 'p4',
    pixelFormat: 'yuv420p',
    fastStart: true,
    gpuAcceleration: 'auto',
    concurrency: 'auto',
    captions: {
      preset: 'bold-retro',
      subtitleMode: 'burn',
      position: 'bottom',
      fontSize: 44,
      marginV: 70, // Centered bottom in square feed
      marginH: 50,
    },
  },
  'instagram-story': {
    width: 1080,
    height: 1920, // 9:16 vertical
    fps: 30,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    audioBitrate: '192k',
    crf: 21,
    preset: 'p4',
    pixelFormat: 'yuv420p',
    fastStart: true,
    gpuAcceleration: 'auto',
    concurrency: 'auto',
    captions: {
      preset: 'neon-glow',
      subtitleMode: 'burn',
      position: 'bottom',
      fontSize: 54,
      marginV: 290, // Above Instagram Story message bar
      marginH: 60,
    },
  },
  web: {
    width: 1280,
    height: 720,
    fps: 30,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    audioBitrate: '128k',
    crf: 23,
    preset: 'medium',
    pixelFormat: 'yuv420p',
    fastStart: true,
    gpuAcceleration: 'auto',
    concurrency: 'auto',
    captions: {
      preset: 'minimal-clean',
      subtitleMode: 'burn',
      position: 'bottom',
      fontSize: 32, // Scaled for 720p web embedded players
      marginV: 45,
      marginH: 40,
    },
  },
  mobile: {
    width: 720,
    height: 1280,
    fps: 30,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    audioBitrate: '128k',
    crf: 24,
    preset: 'fast',
    pixelFormat: 'yuv420p',
    fastStart: true,
    gpuAcceleration: 'auto',
    concurrency: 'auto',
    captions: {
      preset: 'tiktok',
      subtitleMode: 'burn',
      position: 'bottom',
      fontSize: 38, // Scaled for 720p mobile portrait
      marginV: 180,
      marginH: 35,
    },
  },
  custom: {
    width: 1920,
    height: 1080,
    fps: 30,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    audioBitrate: '192k',
    crf: 21,
    preset: 'p4',
    pixelFormat: 'yuv420p',
    fastStart: true,
    gpuAcceleration: 'auto',
    concurrency: 'auto',
    captions: {
      preset: 'classic',
      subtitleMode: 'burn',
      position: 'bottom',
      fontSize: 44,
      marginV: 60,
      marginH: 40,
    },
  },
};

/**
 * Recursively merges user properties into a default object.
 * Ignores `undefined` and `null` values in `userObj`, preserving the default value.
 */
export function mergeDefined<T extends Record<string, any>>(defaultObj: T, userObj?: Record<string, any>): T {
  if (!userObj) {
    return { ...defaultObj };
  }
  const result: any = { ...defaultObj };
  for (const key of Object.keys(userObj)) {
    const val = userObj[key];
    if (val !== undefined && val !== null) {
      if (
        typeof val === 'object' &&
        !Array.isArray(val) &&
        defaultObj[key] &&
        typeof defaultObj[key] === 'object' &&
        !Array.isArray(defaultObj[key])
      ) {
        result[key] = mergeDefined(defaultObj[key], val);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

export const DEFAULT_UPSCALE_SETTINGS: UpscaleSettings = {
  enabled: false,
  model: 'realesrgan-x4plus',
  ratio: 2,
};

export const DEFAULT_BGM_SETTINGS: BGMSettings = {
  source: '',
  volume: 0.1,
  loop: true,
  fadeIn: 0,
  fadeOut: 2,
  autoDucking: true,
};

export const DEFAULT_TRANSITION_SETTINGS: TransitionSettings = {
  enabled: true,
  type: 'fade',
  duration: 1.0,
  audioBehavior: 'crossfade',
};

export const DEFAULT_DEPTH3D_CONFIG: Depth3DConfig = {
  enabled: false,
  mode: 'frame_breaker',
  frameStyle: 'card',
  popOutIntensity: 1.15,
  shadow: true,
  shadowBlur: 25,
  shadowColor: 'rgba(0,0,0,0.6)',
  backdropBlur: 20,
  floatMotion: true,
  autoSegment: false,
  autoDepth: false,
};

export const DEFAULT_TTS_CONFIG: TtsConfig = {
  enabled: false,
  provider: 'vieneu-v3-turbo',
  voice: 'Ngọc Trân',
  speed: 1.0,
};

export const DEFAULT_CAPTION_SETTINGS: CaptionSettings = {
  preset: 'classic',
  subtitleMode: 'burn',
  position: 'bottom',
  alignment: 2,
  marginV: 60,
  marginH: 40,
  autoTranscribe: true,
};

export const DEFAULT_VIDEO_SETTINGS: Required<VideoSettings> = {
  timeBase: 'audio',
  shortVideoMode: 'freeze',
  longVideoMode: 'trim',
  volume: 0.0,
};

let cachedNvidiaSupport: boolean | null = null;

export function checkNvidiaSupport(): boolean {
  if (cachedNvidiaSupport !== null) {
    return cachedNvidiaSupport;
  }
  try {
    const output = execSync(`"${FFmpegManager.getFFmpegPath()}" -encoders`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    cachedNvidiaSupport = output.includes('h264_nvenc');
  } catch {
    cachedNvidiaSupport = false;
  }
  return cachedNvidiaSupport;
}

export function resolveStorySettings(settings?: StorySettings): ResolvedStorySettings {
  const platform = settings?.platform || 'custom';
  const base = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.custom;

  const width = settings?.width ?? base.width;
  const height = settings?.height ?? base.height;
  const fps = settings?.fps ?? base.fps;
  const container = settings?.container ?? base.container;
  const audioBitrate = settings?.audioBitrate ?? base.audioBitrate;
  const crf = settings?.crf ?? base.crf;
  const pixelFormat = settings?.pixelFormat ?? base.pixelFormat;
  const fastStart = settings?.fastStart ?? base.fastStart;
  const gpuAcceleration = settings?.gpuAcceleration ?? base.gpuAcceleration;

  const rawVideoCodec = settings?.videoCodec ?? base.videoCodec;
  const rawAudioCodec = settings?.audioCodec ?? base.audioCodec;
  const rawPreset = settings?.preset ?? base.preset;

  const userConcurrency = settings?.concurrency ?? base.concurrency ?? 'auto';
  let resolvedConcurrency: number;

  if (typeof userConcurrency === 'number' && userConcurrency >= 1) {
    resolvedConcurrency = Math.floor(userConcurrency);
    const is4K = (width && width >= 3840) || (height && height >= 2160);
    if (is4K && resolvedConcurrency > 3) {
      Logger.warn('Platforms', `4K resolution detected with high concurrency (${resolvedConcurrency}). Clamping to 3 parallel workers to prevent RAM and NVENC session exhaustion.`);
      resolvedConcurrency = 3;
    }
  } else {
    // 'auto' mode: calculate optimal parallel slots based on CPU, GPU, and frame resolution
    const cpus = os.cpus()?.length || 4;
    const hasNvidia = checkNvidiaSupport();
    const isGpu = gpuAcceleration !== 'none' && hasNvidia;
    const is4K = (width && width >= 3840) || (height && height >= 2160);

    if (isGpu) {
      // GPU NVENC can comfortably encode 4-6 streams in 1080p, but 4K (33.2MB/frame) must be capped to 2
      resolvedConcurrency = Math.min(Math.max(cpus, 2), is4K ? 2 : 6);
    } else {
      // CPU software encoding (libx264): min(cpus, 4)
      resolvedConcurrency = Math.min(Math.max(Math.floor(cpus / 2), 1), is4K ? 2 : 4);
    }
  }

  const platformCaptionDefaults = base.captions || {};
  const userCaptions = settings?.captions || {};

  const mergedCaptions: CaptionSettings = mergeDefined(
    mergeDefined(DEFAULT_CAPTION_SETTINGS, platformCaptionDefaults),
    userCaptions
  );

  const fastIntermediate = settings?.fastIntermediate ?? true; // Defaults to true for optimal performance

  const upscale = settings?.upscale
    ? mergeDefined(DEFAULT_UPSCALE_SETTINGS, settings.upscale)
    : undefined;

  const bgm = settings?.bgm
    ? mergeDefined(DEFAULT_BGM_SETTINGS, settings.bgm)
    : undefined;

  const transition = settings?.transition
    ? mergeDefined(DEFAULT_TRANSITION_SETTINGS, settings.transition)
    : undefined;

  const depth3d = settings?.depth3d
    ? mergeDefined(DEFAULT_DEPTH3D_CONFIG, settings.depth3d)
    : undefined;

  const tts = settings?.tts
    ? mergeDefined(DEFAULT_TTS_CONFIG, settings.tts)
    : undefined;

  return {
    platform,
    width,
    height,
    fps,
    container,
    videoCodec: rawVideoCodec,
    audioCodec: rawAudioCodec,
    audioBitrate,
    preset: rawPreset,
    crf,
    pixelFormat,
    fastStart,
    gpuAcceleration,
    concurrency: resolvedConcurrency,
    fastIntermediate,
    captions: mergedCaptions,
    transition,
    upscale,
    overlayComposite: settings?.overlayComposite,
    pauseBetweenScenes: settings?.pauseBetweenScenes ?? settings?.pauseBetweenSlides,
    bgm,
    audioTrack: settings?.audioTrack,
    sfx: settings?.sfx,
    depth3d,
    tts,
  };
}


export interface ResolvedFfmpegFlags {
  videoEncoder: string;
  audioEncoder: string;
  outputOptions: string[];
}

export function buildFfmpegEncodingFlags(
  settings: ResolvedStorySettings,
  duration: number
): ResolvedFfmpegFlags {
  const hasNvidia = checkNvidiaSupport();
  const useGpu =
    settings.gpuAcceleration === 'nvidia' ||
    (settings.gpuAcceleration === 'auto' && hasNvidia);

  let videoEncoder = settings.videoCodec;
  let audioEncoder = settings.audioCodec;
  const outputOptions: string[] = [];

  // 1. Resolve Video Codec & Encoding Flags
  if (videoEncoder === 'auto' || videoEncoder === 'h264') {
    if (useGpu && hasNvidia) {
      videoEncoder = 'h264_nvenc';
      const preset = settings.preset.startsWith('p') ? settings.preset : 'p4';
      outputOptions.push(
        `-c:v h264_nvenc`,
        `-preset ${preset}`,
        `-tune hq`,
        `-rc:v vbr`,
        `-cq ${settings.crf}`,
        `-b:v 2500k`,
        `-maxrate 5000k`,
        `-bufsize 10000k`
      );
    } else {
      videoEncoder = 'libx264';
      const preset = settings.preset.startsWith('p') ? 'medium' : settings.preset;
      outputOptions.push(
        `-c:v libx264`,
        `-preset ${preset}`,
        `-crf ${settings.crf}`
      );
    }
  } else if (videoEncoder === 'h265' || videoEncoder === 'hevc') {
    if (useGpu && hasNvidia) {
      videoEncoder = 'hevc_nvenc';
      const preset = settings.preset.startsWith('p') ? settings.preset : 'p4';
      outputOptions.push(
        `-c:v hevc_nvenc`,
        `-preset ${preset}`,
        `-tune hq`,
        `-rc:v vbr`,
        `-cq ${settings.crf}`,
        `-b:v 0`
      );
    } else {
      videoEncoder = 'libx265';
      const preset = settings.preset.startsWith('p') ? 'medium' : settings.preset;
      outputOptions.push(
        `-c:v libx265`,
        `-preset ${preset}`,
        `-crf ${settings.crf}`
      );
    }
  } else if (videoEncoder === 'av1') {
    if (useGpu && hasNvidia) {
      videoEncoder = 'av1_nvenc';
      outputOptions.push(`-c:v av1_nvenc`, `-cq ${settings.crf}`);
    } else {
      videoEncoder = 'libaom-av1';
      outputOptions.push(`-c:v libaom-av1`, `-crf ${settings.crf}`, `-b:v 0`);
    }
  } else if (videoEncoder === 'vp9') {
    videoEncoder = 'libvpx-vp9';
    outputOptions.push(`-c:v libvpx-vp9`, `-crf ${settings.crf}`, `-b:v 0`);
  } else {
    // Explicit encoder name passed (e.g. 'h264_nvenc', 'libx264')
    outputOptions.push(`-c:v ${videoEncoder}`);
    if (videoEncoder.includes('nvenc')) {
      outputOptions.push(`-cq ${settings.crf}`);
    } else {
      outputOptions.push(`-crf ${settings.crf}`);
    }
    if (settings.preset) {
      outputOptions.push(`-preset ${settings.preset}`);
    }
  }

  // 2. Pixel format
  outputOptions.push(`-pix_fmt ${settings.pixelFormat}`);
  outputOptions.push(`-r ${settings.fps}`);

  // 3. Resolve Audio Codec
  if (audioEncoder === 'auto' || !audioEncoder) {
    if (settings.container === 'webm') {
      audioEncoder = 'libopus';
    } else {
      audioEncoder = 'aac';
    }
  } else if (audioEncoder === 'mp3') {
    audioEncoder = 'libmp3lame';
  } else if (audioEncoder === 'opus') {
    audioEncoder = 'libopus';
  }

  outputOptions.push(`-c:a ${audioEncoder}`);
  if (audioEncoder !== 'copy') {
    outputOptions.push(`-b:a ${settings.audioBitrate}`);
  }

  // 4. Web streaming faststart for MP4 / MOV
  if (settings.fastStart && (settings.container === 'mp4' || settings.container === 'mov')) {
    outputOptions.push('-movflags +faststart');
  }

  outputOptions.push('-shortest', `-t ${duration}`);

  return {
    videoEncoder,
    audioEncoder,
    outputOptions,
  };
}

