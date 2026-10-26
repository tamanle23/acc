import { Logger } from "@acc/core";
import { ISoundGenerator, GeneratedSound } from '../../core/interfaces';
import path from 'path';
import fs from 'fs';

export class Fauna implements ISoundGenerator {
  async generate(effect: string, variant: string, subVariant: string, duration: number, outDir: string, customPrompt?: string): Promise<GeneratedSound> {
    const fileName = `${effect}_${variant}_${subVariant}_${duration}s`;
    const audioPath = path.join(outDir, `${fileName}.wav`);
    const jsonPath = path.join(outDir, `${fileName}.json`);

    // To make synthetic FFmpeg audio sound "realistic" without real WAV samples,
    // we must use envelopes (afade), modulation (tremolo/vibrato), and noise types (pink/brown)
    let lavfiInput = '';
    let filters: string[] = [];

    if (subVariant.includes('screech')) {
      lavfiInput = `anoisesrc=c=pink:d=${duration}`;
      filters.push('bandpass=f=2500:width_type=h:width=1000', 'tremolo=f=12:d=0.8', 'afade=t=in:ss=0:d=0.1,afade=t=out:st=1.5:d=0.5');
    } else if (subVariant.includes('squeal')) {
      lavfiInput = `sine=f=800:d=${duration}`;
      filters.push('vibrato=f=15:d=1', 'tremolo=f=8:d=0.6', 'afade=t=in:ss=0:d=0.1,afade=t=out:st=1.0:d=0.8');
    } else if (subVariant.includes('roar')) {
      lavfiInput = `anoisesrc=c=brown:d=${duration}`;
      filters.push('lowpass=f=300', 'tremolo=f=3:d=0.9', 'afade=t=in:ss=0:d=0.2,afade=t=out:st=1.2:d=1.5', 'volume=2.0');
    } else if (subVariant.includes('bark') || subVariant.includes('howl')) {
      lavfiInput = `anoisesrc=c=pink:d=${duration}`;
      filters.push('lowpass=f=1200', 'tremolo=f=15:d=0.5', 'afade=t=in:ss=0:d=0.05,afade=t=out:st=0.3:d=0.2');
    } else if (subVariant.includes('buzz')) {
      lavfiInput = `sine=f=200:d=${duration}`;
      filters.push('tremolo=f=40:d=0.5'); // Fast bee/insect wing buzz
    } else if (variant === 'marine' || subVariant.includes('whale')) {
      lavfiInput = `sine=f=300:d=${duration}`;
      filters.push('vibrato=f=2:d=0.6', 'aecho=0.8:0.9:100:0.5', 'afade=t=in:ss=0:d=0.5,afade=t=out:st=1.5:d=2.0');
    } else if (variant === 'avian' || subVariant.includes('chorus')) {
      lavfiInput = `sine=f=3000:d=${duration}`; // High pitched birds
      filters.push('vibrato=f=10:d=0.8', 'tremolo=f=5:d=0.5', 'afade=t=in:ss=0:d=0.1,afade=t=out:st=1.0:d=0.5');
    } else {
      lavfiInput = `sine=f=150:d=${duration}`;
      filters.push('anull');
    }

    Logger.info('FaunaGenerator', `Applying filters: ${filters.join(', ')}`);

    const filterStr = filters.join(',');
    const cmd = `ffmpeg -y -f lavfi -i "${lavfiInput}" -af "${filterStr}" "${audioPath}"`;

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    await execAsync(cmd);

    const metadata = {
      effect, variant, subVariant, category: 'fauna_creature', duration,
      ffmpegFilters: filters,
      generatedAt: new Date().toISOString()
    };
    fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));

    return { audioPath, jsonPath };
  }
}
