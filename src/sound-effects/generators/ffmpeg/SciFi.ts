import { ISoundGenerator, GeneratedSound } from '../../core/interfaces';
import { FFmpegManager } from '../../../core/FFmpegManager';
import path from 'path';

export class SciFi implements ISoundGenerator {
  async generate(effect: string, variant: string, subVariant: string, duration: number, outDir: string, customPrompt?: string): Promise<GeneratedSound> {
    const fileName = `${effect}_${variant}_${subVariant}_${duration}s`;
    const audioPath = path.join(outDir, `${fileName}.wav`);
    const jsonPath = path.join(outDir, `${fileName}.json`);

    console.log(`[SciFi] Synthesizing ${variant} -> ${subVariant}`);

    let lavfiInput = '';
    let filters: string[] = [];

    if (variant === 'laser' || subVariant.includes('blast')) {
      // Classic "pew" laser blast: Short, sharp, highly modulated burst
      lavfiInput = `sine=f=1500:d=0.3`;
      filters.push(
        'tremolo=f=50:d=1.0', // High speed modulation
        'flanger=delay=5:depth=10:regen=0:width=71:speed=10', // Phase shifting for sci-fi feel
        'afade=t=in:ss=0:d=0.01,afade=t=out:st=0.1:d=0.2' // Fast decay
      );
    } else if (variant === 'warp_drive' || subVariant.includes('warp')) {
      // Building engine hum / hyperdrive
      lavfiInput = `sine=f=60:d=${duration}`; // Deep sub hum
      filters.push(
        'chorus=0.7:0.9:55:0.4:0.25:2',
        'flanger=speed=5', // Swirling energy
        `afade=t=in:ss=0:d=${duration}:curve=exp` // Powering up envelope
      );
    } else if (variant === 'glitch' || subVariant.includes('error')) {
      // Sci-Fi computer glitch / static burst
      lavfiInput = `anoisesrc=c=white:d=${duration}`;
      filters.push(
        'bandpass=f=3000:width_type=h:width=1000',
        'tremolo=f=25:d=0.9', // Stuttering logic
        'tremolo=f=10:d=0.8',
        'afade=t=in:ss=0:d=0.05,afade=t=out:st=0.3:d=0.2'
      );
    } else if (variant === 'forcefield') {
      // Constant electrical hum
      lavfiInput = `sine=f=120:d=${duration}`;
      filters.push(
        'lowpass=f=800',
        'vibrato=f=2:d=0.5',
        'tremolo=f=15:d=0.2' // Electricity buzzing
      );
    } else {
      lavfiInput = `sine=f=440:d=${duration}`;
      filters.push('anull');
    }

    const filterStr = filters.join(',');
    const cmd = `ffmpeg -y -f lavfi -i "${lavfiInput}" -af "${filterStr}" "${audioPath}"`;
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    await execAsync(cmd);

    const metadata = { effect, variant, subVariant, category: 'scifi', duration, ffmpegFilters: filters };
    require('fs').writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));

    return { audioPath, jsonPath };
  }
}



