import { ISoundGenerator, GeneratedSound } from '../../core/interfaces';
import { FFmpegManager } from '../../../core/FFmpegManager';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class UI implements ISoundGenerator {
  async generate(effect: string, variant: string, subVariant: string, duration: number, outDir: string, customPrompt?: string): Promise<GeneratedSound> {
    const fileName = `${effect}_${variant}_${subVariant}_${duration}s`;
    const audioPath = path.join(outDir, `${fileName}.wav`);
    const jsonPath = path.join(outDir, `${fileName}.json`);

    let inputArgs = '';
    let filterComplex = '';

    // Modern UI Sounds
    if (variant === 'hover') {
      inputArgs = `-f lavfi -i "sine=f=1500:d=0.03"`;
      filterComplex = `afade=t=out:st=0.01:d=0.02[out]`;
    } else if (variant === 'click') {
      inputArgs = `-f lavfi -i "anoisesrc=c=pink:d=0.05"`;
      filterComplex = `highpass=f=2000,afade=t=out:st=0.01:d=0.04[out]`;
    } else if (variant === 'success') {
      inputArgs = `-f lavfi -i "anullsrc=r=44100:cl=stereo"`;
      filterComplex = `sine=f=523.25:d=0.6[c];sine=f=659.25:d=0.6[e];sine=f=783.99:d=0.6[g];[c][e][g]amix=inputs=3,tremolo=f=4:d=0.5,afade=t=out:st=0.3:d=0.3[out]`;
    } else if (variant === 'error') {
      inputArgs = `-f lavfi -i "aevalsrc='sgn(sin(2*PI*150*t))':d=0.4"`;
      filterComplex = `afade=t=out:st=0.1:d=0.3[out]`;
    } 
    // Retro 8-bit Sounds
    else if (variant === 'pickup') {
      inputArgs = `-f lavfi -i "aevalsrc='sgn(sin(2*PI*(1000*t + 2000*t*t)))':d=0.2"`;
      filterComplex = `afade=t=out:st=0.1:d=0.1[out]`;
    } else if (variant === 'jump') {
      inputArgs = `-f lavfi -i "aevalsrc='sgn(sin(2*PI*(400*t + 1000*t*t)))':d=0.3"`;
      filterComplex = `afade=t=out:st=0.15:d=0.15[out]`;
    } else if (variant === 'laser') {
      inputArgs = `-f lavfi -i "aevalsrc='sgn(sin(2*PI*(2000*t - 4000*t*t)))':d=0.3"`;
      filterComplex = `afade=t=out:st=0.1:d=0.2[out]`;
    } 
    // Fallback
    else {
      inputArgs = `-f lavfi -i "sine=f=440:d=0.5"`;
      filterComplex = `anull[out]`;
    }

    const ffmpegPath = FFmpegManager.getFFmpegPath();
    const cmd = `"${ffmpegPath}" -y ${inputArgs} -filter_complex "${filterComplex}" -map "[out]" -ar 44100 -ac 2 "${audioPath}"`;
    
    await execAsync(cmd);

    const metadata = { effect, variant, subVariant, category: 'ui', duration, engine: 'ffmpeg', is_procedural_synth: true };
    require('fs').writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));

    return { audioPath, jsonPath };
  }
}
