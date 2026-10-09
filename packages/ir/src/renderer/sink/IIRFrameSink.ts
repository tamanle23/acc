import type { DecoupledAudioMixResult } from '../audio/DecoupledAudioMixer';

export interface SinkInitMetadata {
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  durationSeconds: number;
  outputPath?: string;
  audioPath?: string;
}

export interface SinkFinalizeResult {
  outputPath?: string;
  durationSeconds: number;
  framesConsumed: number;
  fileSizeBytes?: number;
  stats?: Record<string, unknown>;
}

/**
 * IIRFrameSink:
 * Decoupled consumer interface for rasterized video frames and audio mixdown.
 * Allows identical IR render loops to target either:
 * 1. Headless video compilation via native bun:ffi/FFmpeg (FFIVideoEncoderSink)
 * 2. Visual Video Editor playback and scrub surfaces (PreviewCanvasSink)
 * 3. In-memory cryptographic proof accumulator (HashSink)
 */
export interface IIRFrameSink {
  readonly id: string;
  readonly name: string;

  initialize(meta: SinkInitMetadata): Promise<void>;
  consumeFrame(frameIndex: number, rgbaBuffer: Uint8Array): Promise<void> | void;
  finalize(audioResult?: DecoupledAudioMixResult): Promise<SinkFinalizeResult>;
}
