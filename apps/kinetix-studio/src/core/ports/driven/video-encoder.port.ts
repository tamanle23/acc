// ============================================================================
// KINETIX STUDIO - DRIVEN PORT: VIDEO ENCODER PORT (ECMA-429)
// Pure architectural interface decoupling hardware/software video encoding
// (Mediabunny WebCodecs, MediaRecorder, Worker Encoder) from UI state machines.
// ============================================================================

import type { StudioState } from '@/types/studio';
import type { IRenderTargetPort } from './render-target.port';

export interface EncodedVideoResult {
  readonly blob: Blob;
  readonly buffer?: ArrayBuffer;
  readonly durationSec: number;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
}

export interface VideoEncoderOptions {
  readonly state: StudioState;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly scale?: number;
  readonly target?: IRenderTargetPort;
  readonly audioChannels?: Float32Array[];
  readonly audioSampleRate?: number;
  readonly onProgress?: (pct: number, currentFrame: number, totalFrames: number) => void;
  readonly abortSignal?: AbortSignal;
}

export interface IVideoEncoderPort {
  readonly name: string;
  isSupported(): boolean;
  encodeVideo(options: VideoEncoderOptions): Promise<EncodedVideoResult | null>;
}
