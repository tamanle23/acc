import os from 'os';
import { execSync } from 'child_process';
import type { ResolvedStorySettings } from '@acc/core/types';

export interface ResolvedFfmpegFlags {
  videoEncoder: string;
  audioEncoder: string;
  outputOptions: string[];
}

function checkNvidiaSupport(): boolean {
  if (process.platform === 'win32') {
    try {
      execSync('where nvidia-smi', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  } else if (process.platform === 'linux') {
    try {
      execSync('which nvidia-smi', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  return false;
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
        `-b:v 2500k`,
        `-maxrate 5000k`,
        `-bufsize 10000k`
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
  } else if (videoEncoder === 'prores') {
    videoEncoder = 'prores_ks';
    outputOptions.push(
      `-c:v prores_ks`,
      `-profile:v 3`,
      `-vendor apl0`,
      `-bits_per_mb 8000`,
      `-pix_fmt yuv422p10le`
    );
  } else if (videoEncoder === 'vp9') {
    videoEncoder = 'libvpx-vp9';
    outputOptions.push(
      `-c:v libvpx-vp9`,
      `-crf ${settings.crf}`,
      `-b:v 0`
    );
  }

  // Pixel format
  if (videoEncoder !== 'prores_ks') {
    outputOptions.push('-pix_fmt yuv420p');
  }

  // 2. Resolve Audio Codec
  if (audioEncoder === 'auto') {
    if (settings.container === 'webm') {
      audioEncoder = 'libopus';
    } else {
      audioEncoder = 'aac';
    }
  }

  // 3. Container-specific optimisations
  if (settings.container === 'mp4' || settings.container === 'mov') {
    outputOptions.push('-movflags +faststart');
  }

  return {
    videoEncoder,
    audioEncoder,
    outputOptions,
  };
}
