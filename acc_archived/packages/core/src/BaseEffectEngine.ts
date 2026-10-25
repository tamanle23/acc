import { FFmpegCommand } from './FFmpegExecutor';
import { PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';
import os from 'os';
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
    const command = new FFmpegCommand();

    // Configure input stream as raw RGBA video
    const tempRawPath = path.join(os.tmpdir(), `raw_pipe_${Date.now()}_${Math.random().toString(36).substring(7)}.raw`);
    // Note: To preserve stream writing for legacy callers, we write buffer to file or run command
    const writeStream = fs.createWriteStream(tempRawPath);
    inputStream.pipe(writeStream);

    const promise = new Promise<void>((resolve, reject) => {
      writeStream.on('finish', async () => {
        try {
          const cmd = new FFmpegCommand(tempRawPath);
          cmd.inputOptions([
            '-f rawvideo',
            '-pix_fmt rgba',
            `-s ${this.width}x${this.height}`,
            `-r ${this.fps}`
          ]);

          const opts = [`-c:v ${this.pipelineConfig.vcodec}`, `-pix_fmt ${this.pipelineConfig.pix_fmt}`];
          if (this.pipelineConfig.format === 'webm') {
            opts.push('-b:v 2M', '-auto-alt-ref 0');
          } else {
            opts.push('-crf 18', '-preset fast');
          }

          cmd.outputOptions(opts);
          cmd.output(outputPath);
          await cmd.run();
          try { fs.unlinkSync(tempRawPath); } catch {}
          resolve();
        } catch (err) {
          try { fs.unlinkSync(tempRawPath); } catch {}
          reject(err);
        }
      });
      writeStream.on('error', reject);
    });

    return { stream: inputStream, promise };
  }
}
