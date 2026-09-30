import { PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { OverlayEffectConfig } from './types';
import { FFmpegCommand } from '@acc/core';

export class EffectPipeline {
  private config: OverlayEffectConfig;
  private inputStream: PassThrough;
  private tempRawPath: string;
  private writeStream: fs.WriteStream;
  private renderPromise: Promise<void>;

  constructor(config: OverlayEffectConfig) {
    this.config = config;
    this.inputStream = new PassThrough();
    this.tempRawPath = path.join(os.tmpdir(), `effect_raw_${Date.now()}_${Math.random().toString(36).substring(7)}.raw`);
    this.writeStream = fs.createWriteStream(this.tempRawPath);
    this.inputStream.pipe(this.writeStream);

    this.renderPromise = new Promise((resolve, reject) => {
      this.writeStream.on('finish', async () => {
        try {
          const cmd = new FFmpegCommand(this.tempRawPath);
          cmd.inputOptions([
            '-f rawvideo',
            '-pix_fmt rgba',
            `-s ${config.width}x${config.height}`,
            `-r ${config.fps}`
          ]);

          if (config.bgTransparent) {
            cmd.outputOptions([
              '-c:v libvpx-vp9',
              '-pix_fmt yuva420p',
              '-b:v 2M',
              '-auto-alt-ref 0'
            ]);
          } else {
            cmd.outputOptions([
              '-c:v libx264',
              '-pix_fmt yuv420p',
              '-crf 18',
              '-preset fast'
            ]);
          }

          cmd.output(config.output);
          await cmd.run();
          console.log(`\nEffect successfully generated at ${config.output}`);
          try { fs.unlinkSync(this.tempRawPath); } catch {}
          resolve();
        } catch (err: any) {
          console.error('\nFFmpeg encountered an error:', err.message);
          try { fs.unlinkSync(this.tempRawPath); } catch {}
          reject(err);
        }
      });
      this.writeStream.on('error', reject);
    });
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
