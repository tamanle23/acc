/**
 * Universal Media Engine Strategy Types & Contracts
 */

export type MediaEngineType = 'bun-ffi' | 'fluent-ffmpeg' | 'mediabunny-server' | 'mediabunny-client';

export interface MediaEngineCapabilities {
  supportsZeroCopyFFI: boolean;
  supportsComplexFilters: boolean;
  supportsRawFrameStream: boolean;
  supportsBrowserRuntime: boolean;
  requiresNativeBinaries: boolean;
}

export interface MediaProbeResult {
  durationSeconds: number;
  width?: number;
  height?: number;
  fps?: number;
  codecVideo?: string;
  codecAudio?: string;
  bitrateKbps?: number;
  hasAudio: boolean;
  hasVideo: boolean;
}

export interface IChunkExecutionPolicy {
  getOptimalConcurrency(totalChunks: number, systemCores: number): number;
  supportsParallelExecution: boolean;
  executionMode: 'in-process' | 'subprocess' | 'worker-thread' | 'web-worker';
}

export interface MediaAudioMixResult {
  totalSamples: number;
  sampleRate: number;
  channels: number;
  durationSeconds: number;
  buffer: Float32Array;
}

export interface SinkInitMetadata {
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  durationSeconds: number;
  outputPath?: string;
  audioPath?: string;
  tempDir?: string;
}

export interface SinkFinalizeResult {
  outputPath?: string;
  durationSeconds: number;
  framesConsumed: number;
  fileSizeBytes?: number;
  stats?: Record<string, unknown>;
}

export interface IMediaFrameSink {
  readonly id: string;
  readonly name: string;

  initialize(meta: SinkInitMetadata): Promise<void>;
  consumeFrame(frameIndex: number, rgbaBuffer: Uint8Array): Promise<void> | void;
  finalize(audioResult?: MediaAudioMixResult): Promise<SinkFinalizeResult>;
}

export interface IMediaProbeStrategy {
  probe(filePath: string): Promise<MediaProbeResult>;
}

export interface IMediaConcatStrategy {
  concatenate(inputPaths: string[], outputPath: string): Promise<void>;
}

export interface IAudioMuxerStrategy {
  muxAudioVideo(videoPath: string, audioPath: string, outputPath: string): Promise<void>;
}

export interface IMediaEngineStrategy {
  readonly id: MediaEngineType;
  readonly name: string;
  readonly capabilities: MediaEngineCapabilities;

  validatePrerequisites(): void;
  createVideoSink(options?: SinkInitMetadata): IMediaFrameSink;
  getProbeStrategy(): IMediaProbeStrategy;
  getConcatStrategy(): IMediaConcatStrategy;
  getAudioMuxerStrategy(): IAudioMuxerStrategy;
  getChunkPolicy(): IChunkExecutionPolicy;
  executeCommand?(args: string[]): Promise<void>;
}

export class MediaEngineError extends Error {
  constructor(
    public readonly engine: MediaEngineType,
    message: string,
    public readonly exitCode?: number,
    public readonly stderrTail?: string
  ) {
    super(`[MediaEngine:${engine}] ${message}${exitCode !== undefined ? ` (exit code: ${exitCode})` : ''}${stderrTail ? `\n--- STDERR ---\n${stderrTail}` : ''}`);
    this.name = 'MediaEngineError';
  }
}
