import { ISoundGenerator, GeneratedSound } from '../../core/interfaces';
import { FFmpegManager } from '@acc/core';
import path from 'path';

export class Diegetic implements ISoundGenerator {
  async generate(effect: string, variant: string, subVariant: string, duration: number, outDir: string, customPrompt?: string): Promise<GeneratedSound> {
    const fileName = `${effect}_${variant}_${subVariant}_${duration}s`;
    const audioPath = path.join(outDir, `${fileName}.wav`);
    const jsonPath = path.join(outDir, `${fileName}.json`);

    let lavfiInput = '';
    let filters: string[] = [];

    if (variant === 'weather' || subVariant.includes('rain')) {
      lavfiInput = `anoisesrc=c=pink:d=${duration}`;
      if (subVariant.includes('heavy') || subVariant.includes('storm')) {
        filters.push('lowpass=f=2500'); 
      } else {
        filters.push('highpass=f=3000'); 
      }
    } else if (variant === 'weather' && subVariant.includes('wind')) {
      lavfiInput = `anoisesrc=c=pink:d=${duration}`;
      filters.push('bandpass=f=800:width_type=h:width=400', 'tremolo=f=0.5:d=0.6');
    } else if (variant === 'water') {
      lavfiInput = `anoisesrc=c=pink:d=${duration}`;
      filters.push(
        'lowpass=f=1200', 
        'tremolo=f=0.2:d=0.7' // Slow crashing ocean waves
      );
    } else if (variant === 'urban' || variant === 'traffic') {
      lavfiInput = `anoisesrc=c=brown:d=${duration}`;
      filters.push('lowpass=f=400', 'tremolo=f=1:d=0.3');
    } else if (variant === 'mechanical') {
      if (subVariant.includes('engine')) {
        lavfiInput = `sine=f=80:d=${duration}`; // Deep engine hum
        filters.push('vibrato=f=10:d=0.5', 'volume=2.0');
      } else {
        lavfiInput = `anoisesrc=c=white:d=${duration}`;
        filters.push('highpass=f=4000', 'tremolo=f=2:d=1.0'); // Ticking clock/creak
      }
    } else if (variant === 'weapon' || subVariant.includes('gunshot')) {
      lavfiInput = `anoisesrc=c=white:d=${duration}`;
      filters.push(
        'lowpass=f=3000',
        'afade=t=in:ss=0:d=0.005,afade=t=out:st=0.05:d=0.5', // Extremely sharp explosion transient
        'volume=4.0'
      );
    } else if (variant === 'bell' || subVariant.includes('doorbell')) {
      lavfiInput = `sine=f=880:d=${duration}`;
      filters.push(
        'tremolo=f=3:d=0.8', // Simulate dual-tone ding-dong pulsing
        'aecho=0.8:0.9:50:0.4',
        'afade=t=in:ss=0:d=0.05,afade=t=out:st=0.5:d=1.0'
      );
    } else if (variant === 'chatter' || subVariant.includes('chatter')) {
      lavfiInput = `anoisesrc=c=pink:d=${duration}`;
      filters.push(
        'bandpass=f=1000:width_type=h:width=500', // Human vocal frequency range
        'tremolo=f=2:d=0.5', // Crowd mumbling fluctuation
        'volume=0.5'
      );
    } else {
      lavfiInput = `anoisesrc=c=white:d=${duration}`;
      filters.push('anull');
    }

    const filterStr = filters.join(',');
    const cmd = `ffmpeg -y -f lavfi -i "${lavfiInput}" -af "${filterStr}" "${audioPath}"`;
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    await execAsync(cmd);

    const metadata = { effect, variant, subVariant, category: 'diegetic', duration, ffmpegFilters: filters };
    require('fs').writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));

    return { audioPath, jsonPath };
  }
}



