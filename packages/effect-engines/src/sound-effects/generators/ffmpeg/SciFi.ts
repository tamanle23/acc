import { GeneratedSound } from '../../core/interfaces';
import { BaseFFmpegGenerator } from '../base';

export class SciFi extends BaseFFmpegGenerator {
  async generate(
    effect: string,
    variant: string,
    subVariant: string,
    duration: number,
    outDir: string
  ): Promise<GeneratedSound> {
    const { audioPath, jsonPath } = this.getOutputFilePaths(effect, variant, subVariant, duration, outDir);
    const dur = Math.max(duration, 0.1);

    let inputArgs: string[] = [];
    let filterComplex = '';

    if (variant === 'laser' || subVariant.includes('blast') || subVariant.includes('cannon')) {
      inputArgs = ['-f', 'lavfi', '-i', `aevalsrc='sgn(sin(2*PI*(1800*t - 3200*t*t)))':d=${dur}`];
      filterComplex = `flanger=delay=4:depth=8:regen=15:width=60:speed=10,aphaser=type=t:speed=0.8:decay=0.6,${this.buildADSRFilter(dur, 0.005, dur * 0.8)}[out]`;
    } else if (variant === 'warp_drive' || subVariant.includes('warp') || subVariant.includes('singularity')) {
      inputArgs = ['-f', 'lavfi', '-i', `sine=f=55:d=${dur}`];
      filterComplex = `chorus=0.7:0.9:55:0.4:0.25:2,flanger=delay=10:depth=20:speed=3,aecho=0.8:0.9:80:0.4,${this.buildADSRFilter(dur, dur * 0.4, dur * 0.3)}[out]`;
    } else if (variant === 'glitch' || subVariant.includes('corrupt') || subVariant.includes('burst')) {
      inputArgs = ['-f', 'lavfi', '-i', `anoisesrc=c=white:d=${dur}`];
      filterComplex = `bandpass=f=2800:width_type=h:width=1500,tremolo=f=35:d=0.9,tremolo=f=12:d=0.8,${this.buildADSRFilter(dur, 0.01, dur * 0.6)}[out]`;
    } else if (variant === 'forcefield' || subVariant.includes('shield') || subVariant.includes('barrier')) {
      inputArgs = ['-f', 'lavfi', '-i', `sine=f=120:d=${dur}`];
      filterComplex = `vibrato=f=4:d=0.6,tremolo=f=18:d=0.4,flanger=delay=5:speed=2,aecho=0.7:0.8:60:0.3,${this.buildADSRFilter(dur, 0.1, 0.3)}[out]`;
    } else {
      inputArgs = ['-f', 'lavfi', '-i', `sine=f=350:d=${dur}`];
      filterComplex = `tremolo=f=15:d=0.5,${this.buildADSRFilter(dur, 0.05, 0.2)}[out]`;
    }

    const args = [
      '-y',
      ...inputArgs,
      '-filter_complex', filterComplex,
      '-map', '[out]',
      '-ar', '44100',
      '-ac', '2',
      audioPath
    ];

    await this.executeFFmpeg(args);

    this.writeMetadata(jsonPath, {
      effect,
      variant,
      subVariant,
      category: 'scifi',
      duration: dur,
      engine: 'ffmpeg_procedural',
      qualityGrade: 'studio_dsp'
    });

    return { audioPath, jsonPath };
  }
}
