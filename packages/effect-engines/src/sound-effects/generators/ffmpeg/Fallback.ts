import { Logger } from "@acc/core";
import { ISoundGenerator, GeneratedSound } from '../../core/interfaces';
import { FFmpegManager } from '@acc/core';
import path from 'path';
import fs from 'fs';

export class Fallback implements ISoundGenerator {
  async generate(effect: string, variant: string, subVariant: string, duration: number, outDir: string, customPrompt?: string): Promise<GeneratedSound> {
    const fileName = `${effect}_${variant}_${subVariant}_${duration}s`;
    const audioPath = path.join(outDir, `${fileName}.wav`);
    const jsonPath = path.join(outDir, `${fileName}.json`);

    const filters = ['anull']; // Default fallback filter

    Logger.info('FallbackGenerator', `Synthesizing ${variant} -> ${subVariant}`);

    // Use FFmpeg lavfi to generate a real synthetic sine wave fallback
    const filterStr = filters.join(',');
    const cmd = `ffmpeg -y -f lavfi -i "sine=f=440:d=${duration}" -af "${filterStr}" "${audioPath}"`;

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    await execAsync(cmd);

    const metadata = {
      effect, variant, subVariant, category: 'generic', duration,
      ffmpegFilters: filters,
      generatedAt: new Date().toISOString()
    };
    fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));

    return { audioPath, jsonPath };
  }
}
