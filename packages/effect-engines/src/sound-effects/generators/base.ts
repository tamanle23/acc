import { ISoundGenerator, GeneratedSound } from '../core/interfaces';
import { FFmpegManager } from '@acc/core';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export abstract class BaseSoundGenerator implements ISoundGenerator {
  protected getOutputFilePaths(
    effect: string,
    variant: string,
    subVariant: string,
    duration: number,
    outDir: string,
    suffix?: string
  ): { audioPath: string; jsonPath: string; baseName: string } {
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const cleanSuffix = suffix ? `_${suffix}` : '';
    const baseName = `${effect}_${variant}_${subVariant}_${duration}s${cleanSuffix}`;
    const audioPath = path.join(outDir, `${baseName}.wav`);
    const jsonPath = path.join(outDir, `${baseName}.json`);
    return { audioPath, jsonPath, baseName };
  }

  protected writeMetadata(jsonPath: string, metadata: Record<string, any>): void {
    const payload = {
      ...metadata,
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  }

  abstract generate(
    effect: string,
    variant: string,
    subVariant: string,
    duration: number,
    outDir: string,
    customPrompt?: string
  ): Promise<GeneratedSound>;
}

export abstract class BaseFFmpegGenerator extends BaseSoundGenerator {
  protected async executeFFmpeg(args: string[]): Promise<void> {
    await FFmpegManager.prepare();
    const ffmpegPath = FFmpegManager.getFFmpegPath();
    await execFileAsync(ffmpegPath, args);
  }

  protected buildADSRFilter(
    duration: number,
    attack: number = 0.01,
    release: number = 0.2
  ): string {
    const releaseStart = Math.max(0.01, duration - release);
    return `afade=t=in:ss=0:d=${attack},afade=t=out:st=${releaseStart}:d=${release}`;
  }
}
