import { ISoundGenerator, GeneratedSound } from '../../core/interfaces';
import { FFmpegManager } from '@acc/core';
import path from 'path';

export class Cinematic implements ISoundGenerator {
  async generate(effect: string, variant: string, subVariant: string, duration: number, outDir: string, customPrompt?: string): Promise<GeneratedSound> {
    const fileName = `${effect}_${variant}_${subVariant}_${duration}s`;
    const audioPath = path.join(outDir, `${fileName}.wav`);
    const jsonPath = path.join(outDir, `${fileName}.json`);

    let lavfiInput = '';
    let filters: string[] = [];

    if (variant === 'transition' || variant === 'whoosh') {
      // Metallic air suck whoosh
      lavfiInput = `anoisesrc=c=white:d=${duration}`;
      filters.push(
        'bandpass=f=5000:width_type=h:width=2000',
        'flanger=delay=2:depth=5:regen=20:width=71:speed=5', 
        `afade=t=in:ss=0:d=${duration*0.9}:curve=exp,afade=t=out:st=${duration*0.9}:d=${duration*0.1}`
      );
    } else if (variant === 'impact' || variant === 'hit') {
      // Hard distorted sub drop / kick
      lavfiInput = `sine=f=55:d=${duration}`;
      filters.push(
        'lowpass=f=200', 
        'tremolo=f=10:d=0.5', // Gritty rumble
        `afade=t=in:ss=0:d=0.01,afade=t=out:st=0.1:d=${duration-0.1}:curve=exp`, // Hard attack, long slow decay
        'volume=5.0'
      );
    } else if (variant === 'tension' || variant === 'braam') {
      // Braam / Tension: Low pulsating tone
      lavfiInput = `sine=f=55:d=${duration}`; // Low A or G
      filters.push(
        'tremolo=f=5:d=0.8',
        'chorus=0.7:0.9:55:0.4:0.25:2',
        `afade=t=in:ss=0:d=0.5,afade=t=out:st=${duration-1}:d=1.0`
      );
    } else if (variant === 'reverse') {
      lavfiInput = `anoisesrc=c=pink:d=${duration}`;
      filters.push(
        'lowpass=f=2000',
        `afade=t=in:ss=0:d=${duration}:curve=exp` // Exponential fade in to simulate reversed impact
      );
    } else if (variant === 'riser') {
      lavfiInput = `anoisesrc=c=white:d=${duration}`;
      filters.push(
        'highpass=f=1000',
        'flanger=delay=20:depth=10:regen=50:width=100:speed=2',
        `afade=t=in:ss=0:d=${duration}:curve=exp`, // Tension build-up
        'volume=1.5'
      );
    } else if (variant === 'stinger') {
      lavfiInput = `sine=f=2000:d=${duration}`; // High-pitched shock
      filters.push(
        'tremolo=f=10:d=0.5',
        'aecho=0.8:0.9:50:0.4',
        'afade=t=in:ss=0:d=0.01,afade=t=out:st=0.5:d=2.0'
      );
    } else {
      lavfiInput = `sine=f=100:d=${duration}`;
      filters.push('anull');
    }

    const filterStr = filters.join(',');
    const cmd = `ffmpeg -y -f lavfi -i "${lavfiInput}" -af "${filterStr}" "${audioPath}"`;
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    await execAsync(cmd);

    const metadata = { effect, variant, subVariant, category: 'cinematic', duration, ffmpegFilters: filters };
    require('fs').writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));

    return { audioPath, jsonPath };
  }
}



