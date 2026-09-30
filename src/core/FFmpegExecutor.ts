import { FFmpegManager } from './FFmpegManager';
import fs from 'fs';

import { getMediaDurationFFI } from './ffmpeg-ffi';

export function getMediaDurationSync(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  return getMediaDurationFFI(filePath);
}

export function getMediaDuration(filePath: string): Promise<number> {
  return Promise.resolve(getMediaDurationSync(filePath));
}

export class FFmpegCommand {
  private inputs: { file: string; options: string[] }[] = [];
  private outputOpts: string[] = [];
  private complexFilterStr: string | null = null;
  private outputFile: string = '';
  private isLoop: boolean = false;
  private loopDuration: number = 0;

  constructor(input?: string) {
    if (input) {
      this.input(input);
    }
  }

  public input(file: string): this {
    this.inputs.push({ file, options: [] });
    return this;
  }

  public inputOptions(options: string[]): this {
    if (this.inputs.length > 0) {
      this.inputs[this.inputs.length - 1].options.push(...options);
    }
    return this;
  }

  public inputOption(option: string, value?: string): this {
    const opts = value !== undefined ? [option, value] : [option];
    return this.inputOptions(opts);
  }

  public loop(duration?: number): this {
    this.isLoop = true;
    if (duration !== undefined) this.loopDuration = duration;
    return this;
  }

  public complexFilter(filter: string | string[], map?: string[]): this {
    if (Array.isArray(filter)) {
      this.complexFilterStr = filter.join(';');
    } else {
      this.complexFilterStr = filter;
    }
    if (map && map.length > 0) {
      for (const m of map) {
        const label = m.startsWith('[') && m.endsWith(']') ? m : `[${m}]`;
        this.outputOptions(['-map', label]);
      }
    }
    return this;
  }

  public videoFilters(filters: string | string[]): this {
    const filterStr = Array.isArray(filters) ? filters.join(',') : filters;
    this.outputOptions(['-vf', filterStr]);
    return this;
  }

  public outputOptions(options: string[]): this {
    this.outputOpts.push(...options);
    return this;
  }

  public output(file: string): this {
    this.outputFile = file;
    return this;
  }

  public buildArgs(): string[] {
    const args: string[] = ['-y'];

    for (let i = 0; i < this.inputs.length; i++) {
      const inp = this.inputs[i];
      if (i === 0 && this.isLoop) {
        args.push('-loop', '1');
      }
      if (inp.options.length > 0) {
        for (const opt of inp.options) {
          const parts = opt.trim().split(/\s+/);
          args.push(...parts);
        }
      }
      args.push('-i', inp.file);
    }

    if (this.isLoop && this.loopDuration > 0) {
      args.push('-t', this.loopDuration.toString());
    }

    if (this.complexFilterStr) {
      args.push('-filter_complex', this.complexFilterStr);
    }

    if (this.outputOpts.length > 0) {
      for (const opt of this.outputOpts) {
        const parts = opt.trim().split(/\s+/);
        args.push(...parts);
      }
    }

    if (this.outputFile) {
      args.push(this.outputFile);
    }

    return args;
  }

  private endListeners: Function[] = [];
  private errorListeners: Function[] = [];
  private startListeners: Function[] = [];

  public videoCodec(codec: string): this {
    this.outputOpts.push('-c:v', codec);
    return this;
  }

  public audioCodec(codec: string): this {
    this.outputOpts.push('-c:a', codec);
    return this;
  }

  public audioBitrate(bitrate: string | number): this {
    this.outputOpts.push('-b:a', String(bitrate));
    return this;
  }

  public audioFrequency(freq: number): this {
    this.outputOpts.push('-ar', String(freq));
    return this;
  }

  public audioChannels(channels: number): this {
    this.outputOpts.push('-ac', String(channels));
    return this;
  }

  public noVideo(): this {
    this.outputOpts.push('-vn');
    return this;
  }

  public outputFormat(fmt: string): this {
    this.outputOpts.push('-f', fmt);
    return this;
  }

  public on(event: string, listener: Function): this {
    if (event === 'end') {
      this.endListeners.push(listener);
    } else if (event === 'error') {
      this.errorListeners.push(listener);
    } else if (event === 'start' || event === 'stderr') {
      this.startListeners.push(listener);
    }
    return this;
  }

  public run(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const ffmpegPath = FFmpegManager.getFFmpegPath();
        const args = this.buildArgs();

        for (const fn of this.startListeners) {
          try { fn(`${ffmpegPath} ${args.join(' ')}`); } catch {}
        }

        const proc = Bun.spawn({
          cmd: [ffmpegPath, ...args],
          stdout: 'pipe',
          stderr: 'pipe',
        });

        proc.exited.then(async (code) => {
          if (code === 0) {
            for (const fn of this.endListeners) {
              try { fn(); } catch {}
            }
            resolve();
          } else {
            const stderrText = await new Response(proc.stderr).text();
            const err = new Error(`FFmpeg exited with code ${code}:\n${stderrText}`);
            for (const fn of this.errorListeners) {
              try { fn(err, '', stderrText); } catch {}
            }
            reject(err);
          }
        }).catch((err) => {
          for (const fn of this.errorListeners) {
            try { fn(err, '', err.message); } catch {}
          }
          reject(err);
        });
      } catch (err: any) {
        for (const fn of this.errorListeners) {
          try { fn(err, '', err.message); } catch {}
        }
        reject(err);
      }
    });
  }
}

export function ffmpeg(input?: string): FFmpegCommand {
  return new FFmpegCommand(input);
}

export default ffmpeg;

