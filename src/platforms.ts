import { execSync } from 'child_process';
import { FFmpegManager } from './core/FFmpegManager';
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
} from './types';

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
      fontSize: 54,
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
      fontSize: 54,
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
      fontSize: 54,
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
  } else {
    // 'auto' mode: calculate optimal parallel slots
    const cpus = os.cpus()?.length || 4;
    const hasNvidia = checkNvidiaSupport();
    const isGpu = gpuAcceleration !== 'none' && hasNvidia;

    if (isGpu) {
      // GPU NVENC can comfortably encode 4-6 streams simultaneously while CPU feeds libass subtitles
      resolvedConcurrency = Math.min(Math.max(cpus, 2), 6);
    } else {
      // CPU software encoding (libx264): min(cpus, 4)
      resolvedConcurrency = Math.min(Math.max(Math.floor(cpus / 2), 1), 4);
    }
  }

  const platformCaptionDefaults = base.captions || {};
  const userCaptions = settings?.captions || {};

  const mergedCaptions: CaptionSettings = {
    ...platformCaptionDefaults,
    ...userCaptions,
  };

  const fastIntermediate = settings?.fastIntermediate ?? true; // Defaults to true for optimal performance

  const upscale = settings?.upscale
    ? {
        enabled: settings.upscale.enabled,
        model: settings.upscale.model ?? 'realesrgan-x4plus',
        ratio: settings.upscale.ratio ?? 2,
      }
    : undefined;

  const bgm = settings?.bgm
    ? {
        ...settings.bgm,
        volume: settings.bgm.volume ?? 0.1,
        loop: settings.bgm.loop ?? true,
        fadeIn: settings.bgm.fadeIn ?? 0,
        fadeOut: settings.bgm.fadeOut ?? 2,
        autoDucking: settings.bgm.autoDucking ?? true,
      }
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
    transition: settings?.transition,
    upscale,
    overlayComposite: settings?.overlayComposite,
    pauseBetweenScenes: settings?.pauseBetweenScenes || settings?.pauseBetweenSlides,
    bgm,
    depth3d: settings?.depth3d,
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
        `-cq ${settings.crf}`
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
        `-cq ${settings.crf}`
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

