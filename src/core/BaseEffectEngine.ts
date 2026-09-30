import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import { PipelineConfig } from './Registry';

export abstract class BaseEffectEngine {
  protected variantName: string;
  protected duration: number;
  protected pipelineConfig: PipelineConfig;

  // Default values that child implementations can use or override
  protected width: number = 1920;
  protected height: number = 1080;
  protected fps: number = 30;

  public setDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  public setFps(fps: number): void {
    this.fps = fps;
  }

  constructor(variantName: string, duration: number, pipelineConfig: PipelineConfig) {
    this.variantName = variantName;
    this.duration = duration;
    this.pipelineConfig = pipelineConfig;
  }

  /**
   * Generates the effect frames and pipes them to FFmpeg.
   */
  abstract renderAndPipe(outputPath: string): Promise<void>;

  /**
   * Helper method to initialize an FFmpeg process configured via pipelineConfig.
   * Returns an input stream (PassThrough) where raw RGBA buffers can be piped,
   * and a Promise that resolves when FFmpeg finishes encoding the file.
   */
  protected initStream(outputPath: string): { stream: PassThrough, promise: Promise<void> } {
    const inputStream = new PassThrough();
    const command = ffmpeg(inputStream as any)
      .inputFormat('rawvideo')
      .inputOptions([
        '-pix_fmt rgba',
        `-s ${this.width}x${this.height}`,
        `-r ${this.fps}`
      ]);

    // Apply strict pipeline configuration from registry
    command
      .output(outputPath)
      .videoCodec(this.pipelineConfig.vcodec)
      .outputOptions([
        `-pix_fmt ${this.pipelineConfig.pix_fmt}`
      ]);

    // Apply format-specific optimizations
    if (this.pipelineConfig.format === 'webm') {
      command.outputOptions([
        '-b:v 2M',
        '-auto-alt-ref 0'
      ]);
    } else {
      command.outputOptions([
        '-crf 18',
        '-preset fast'
      ]);
    }

    const promise = new Promise<void>((resolve, reject) => {
      command.on('end', () => resolve());
      command.on('error', (err) => reject(err));
    });

    command.run();

    return { stream: inputStream, promise };
  }
}
