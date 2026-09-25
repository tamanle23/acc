import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import { OverlayEffectConfig } from './types';

export class EffectPipeline {
  private config: OverlayEffectConfig;
  private inputStream: PassThrough;
  private ffmpegCommand: ffmpeg.FfmpegCommand;
  private renderPromise: Promise<void>;

  constructor(config: OverlayEffectConfig) {
    this.config = config;
    this.inputStream = new PassThrough();
    this.ffmpegCommand = ffmpeg(this.inputStream as any);
    
    // Configure input stream as raw RGBA video
    this.ffmpegCommand
      .inputFormat('rawvideo')
      .inputOptions([
        '-pix_fmt rgba',
        `-s ${config.width}x${config.height}`,
        `-r ${config.fps}`
      ]);

    // Configure output
    if (config.bgTransparent) {
      // WebM with VP9 codec for transparent alpha background
      this.ffmpegCommand
        .output(config.output)
        .videoCodec('libvpx-vp9')
        .outputOptions([
          '-pix_fmt yuva420p', // Pixel format with alpha channel
          '-b:v 2M',           // 2Mbps bitrate, adjust as needed
          '-auto-alt-ref 0'    // Required for some players with alpha WebM
        ]);
    } else {
      // Standard MP4 with H.264
      this.ffmpegCommand
        .output(config.output)
        .videoCodec('libx264')
        .outputOptions([
          '-pix_fmt yuv420p',  // Standard pixel format
          '-crf 18',           // High quality
          '-preset fast'
        ]);
    }

    // Set up the promise that resolves when rendering is done
    this.renderPromise = new Promise((resolve, reject) => {
      this.ffmpegCommand.on('end', () => {
        console.log(`\nEffect successfully generated at ${config.output}`);
        resolve();
      });
      
      this.ffmpegCommand.on('error', (err) => {
        console.error('\nFFmpeg encountered an error:', err.message);
        reject(err);
      });
    });

    // Start FFmpeg process
    this.ffmpegCommand.run();
  }

  /**
   * Pushes a raw RGBA frame buffer into the pipeline.
   * @param buffer Uint8Array or Buffer containing RGBA pixels
   */
  pushFrame(buffer: Buffer | Uint8Array) {
    this.inputStream.write(buffer);
  }

  /**
   * Closes the stream and waits for FFmpeg to finish encoding.
   */
  async close(): Promise<void> {
    this.inputStream.end();
    await this.renderPromise;
  }
}
