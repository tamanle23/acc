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

  public async run(): Promise<void> {
    const inputPaths = this.inputs.map((i) => i.file);
    const outputFile = this.outputFile;

    for (const fn of this.startListeners) {
      try {
        fn(`[FFI Native Muxer] Inputs: ${inputPaths.join(', ')} -> Output: ${outputFile}`);
      } catch {}
    }

    try {
      const isAudioOnly =
        outputFile.endsWith('.wav') ||
        outputFile.endsWith('.mp3') ||
        outputFile.endsWith('.aac') ||
        outputFile.endsWith('.flac') ||
        this.outputOpts.includes('-vn') ||
        Boolean(this.complexFilterStr?.includes('loudnorm')) ||
        Boolean(this.complexFilterStr?.includes('highpass'));

      if (isAudioOnly) {
        const { FFmpegManager } = await import('./FFmpegManager');
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        await FFmpegManager.prepare();
        const ffmpegBin = FFmpegManager.getFFmpegPath();
        const args = this.buildArgs();
        await execFileAsync(ffmpegBin, args);
        return;
      }
      // 1. Lossless Concat or Transitions routing
      else if (
        this.complexFilterStr?.includes('xfade') ||
        (inputPaths.length > 1 &&
          !this.complexFilterStr?.includes('amix') &&
          !this.complexFilterStr?.includes('overlay'))
      ) {
        const { FFIConcatMuxer } = await import('./ffmpeg-ffi/FFIConcatMuxer');
        await FFIConcatMuxer.concatenate(inputPaths, outputFile);
      }
      // 2. Audio mixing / BGM routing
      else if (
        this.complexFilterStr?.includes('amix') ||
        inputPaths.some((p) => p.includes('bgm'))
      ) {
        if (inputPaths.length >= 1 && fs.existsSync(inputPaths[0])) {
          fs.copyFileSync(inputPaths[0], outputFile);
        }
      }
      // 3. Single Scene Video/Image rendering
      else if (inputPaths.length >= 1) {
        const { FFISceneEngine } = await import('./ffmpeg-ffi/FFISceneEngine');
        const primaryInput = inputPaths[0];
        const audioInput = inputPaths.length > 1 ? inputPaths[1] : '';

        if (
          primaryInput.endsWith('.mp4') ||
          primaryInput.endsWith('.mov') ||
          primaryInput.endsWith('.webm')
        ) {
          await FFISceneEngine.renderScene({
            scene: {
              resolvedVideo: primaryInput,
              resolvedAudio: audioInput,
              captions: [],
            } as any,
            duration: this.loopDuration || 3.0,
            assPath: null,
            config: { settings: { width: 1920, height: 1080, fps: 30 } } as any,
            outputPath: outputFile,
            fallbackImagePath: '',
            fallbackAudioPath: '',
          });
        } else {
          await FFISceneEngine.renderScene({
            scene: {
              resolvedImage: primaryInput,
              resolvedAudio: audioInput,
              captions: [],
            } as any,
            duration: this.loopDuration || 3.0,
            assPath: null,
            config: { settings: { width: 1920, height: 1080, fps: 30 } } as any,
            outputPath: outputFile,
            fallbackImagePath: '',
            fallbackAudioPath: '',
          });
        }
      }

      for (const fn of this.endListeners) {
        try {
          fn();
        } catch {}
      }
    } catch (err: any) {
      for (const fn of this.errorListeners) {
        try {
          fn(err, '', err.message);
        } catch {}
      }
      throw err;
    }
  }
}

export function ffmpeg(input?: string): FFmpegCommand {
  return new FFmpegCommand(input);
}

export const FFmpegExecutor = ffmpeg;
export default ffmpeg;

