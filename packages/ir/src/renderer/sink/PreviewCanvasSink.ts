import type { IIRFrameSink, SinkInitMetadata, SinkFinalizeResult } from './IIRFrameSink';
import type { DecoupledAudioMixResult } from '../audio/DecoupledAudioMixer';

export type PreviewFrameCallback = (frameIndex: number, rgbaBuffer: Uint8Array, meta: SinkInitMetadata) => void;

/**
 * PreviewCanvasSink:
 * In-memory video frame sink designed for interactive visual video editors and preview scrubbers.
 * Directly notifies frontend canvas contexts or preview components per frame,
 * retaining latest frame buffers without writing to disk.
 */
export class PreviewCanvasSink implements IIRFrameSink {
  public readonly id = 'preview-canvas-sink';
  public readonly name = 'Interactive Visual Video Editor Preview Sink';

  private meta?: SinkInitMetadata;
  private onFrame?: PreviewFrameCallback;
  private framesConsumed: number = 0;
  private latestBuffer?: Uint8Array;

  constructor(onFrame?: PreviewFrameCallback) {
    this.onFrame = onFrame;
  }

  public async initialize(meta: SinkInitMetadata): Promise<void> {
    this.meta = meta;
    this.framesConsumed = 0;
    this.latestBuffer = undefined;
  }

  public consumeFrame(frameIndex: number, rgbaBuffer: Uint8Array): void {
    this.framesConsumed++;
    this.latestBuffer = rgbaBuffer;

    if (this.onFrame && this.meta) {
      this.onFrame(frameIndex, rgbaBuffer, this.meta);
    }
  }

  public async finalize(audioResult?: DecoupledAudioMixResult): Promise<SinkFinalizeResult> {
    return {
      durationSeconds: this.meta ? this.meta.durationSeconds : 0,
      framesConsumed: this.framesConsumed,
      stats: {
        mode: 'preview-canvas',
        resolution: this.meta ? `${this.meta.width}x${this.meta.height}` : 'unknown',
        fps: this.meta?.fps,
        hasAudio: Boolean(audioResult && audioResult.totalSamples > 0),
      },
    };
  }

  public getLatestFrame(): Uint8Array | undefined {
    return this.latestBuffer;
  }
}
