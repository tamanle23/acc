import { ISoundGenerator, GeneratedSound } from '../../core/interfaces';
import { FFmpegManager } from '@acc/core';
import path from 'path';
import fs from 'fs';

export class Foley implements ISoundGenerator {
  async generate(effect: string, variant: string, subVariant: string, duration: number, outDir: string, customPrompt?: string): Promise<GeneratedSound> {
    const fileName = `${effect}_${variant}_${subVariant}_${duration}s`;
    const audioPath = path.join(outDir, `${fileName}.wav`);
    const jsonPath = path.join(outDir, `${fileName}.json`);

    console.log(`[Foley] Synthesizing ${variant} -> ${subVariant}`);

    // Foley requires sharp, percussive envelopes rather than continuous noise.
    let filters: string[] = [];
    let lavfiInput = `anoisesrc=c=pink:d=${duration}`;

    if (effect === 'footsteps' || subVariant.includes('heavy')) {
      filters.push(
        'lowpass=f=250',
        'afade=t=in:ss=0:d=0.01,afade=t=out:st=0.1:d=0.2',
        'volume=3.0'
      );
    } else if (effect === 'cloth' || variant === 'cloth') {
      lavfiInput = `anoisesrc=c=white:d=${duration}`;
      filters.push(
        'bandpass=f=4000:width_type=h:width=2000',
        'afade=t=in:ss=0:d=0.05,afade=t=out:st=0.2:d=0.3', // Quick rustle
        'volume=1.5'
      );
    } else if (effect === 'handling' || variant === 'handling') {
      lavfiInput = `anoisesrc=c=white:d=${duration}`;
      filters.push(
        'highpass=f=6000',
        'tremolo=f=15:d=1.0', // Clinking/shattering modulation
        'afade=t=in:ss=0:d=0.01,afade=t=out:st=0.1:d=0.4',
        'volume=2.0'
      );
    } else if (effect === 'typing' || variant === 'typing') {
      filters.push(
        'highpass=f=2000',
        'tremolo=f=12:d=0.9', // Fast bursting keystrokes
        'afade=t=in:ss=0:d=0.01,afade=t=out:st=0.8:d=0.2'
      );
    } else if (effect === 'liquid' || variant === 'liquid' || subVariant.includes('pouring')) {
      lavfiInput = `anoisesrc=c=brown:d=${duration}`;
      filters.push(
        'highpass=f=1000',
        'bandpass=f=2000:width_type=h:width=500',
        'tremolo=f=25:d=0.7', // High-speed gurgling/splashing modulation
        'afade=t=in:ss=0:d=0.1,afade=t=out:st=1.5:d=0.5'
      );
    } else {
      filters.push('anull');
    }

    console.log(`[Foley] Applying filters: ${filters.join(', ')}`);

    const filterStr = filters.join(',');
    const cmd = `ffmpeg -y -f lavfi -i "${lavfiInput}" -af "${filterStr}" "${audioPath}"`;
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    await execAsync(cmd);

    const metadata = {
      effect, variant, subVariant, category: 'foley', duration,
      ffmpegFilters: filters,
      generatedAt: new Date().toISOString()
    };
    fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));

    return { audioPath, jsonPath };
  }
}



