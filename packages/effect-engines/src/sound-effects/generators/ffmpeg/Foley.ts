import { GeneratedSound } from '../../core/interfaces';
import { BaseFFmpegGenerator } from '../base';

export class Foley extends BaseFFmpegGenerator {
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

    if (effect === 'footsteps' || subVariant.includes('boots') || subVariant.includes('footstep')) {
      inputArgs = ['-f', 'lavfi', '-i', `anoisesrc=c=brown:d=${dur}`];
      filterComplex = `lowpass=f=280,${this.buildADSRFilter(dur, 0.005, dur * 0.8)}[out]`;
    } else if (effect === 'cloth' || variant === 'cloth' || subVariant.includes('rustle') || subVariant.includes('swish')) {
      inputArgs = ['-f', 'lavfi', '-i', `anoisesrc=c=white:d=${dur}`];
      filterComplex = `bandpass=f=3500:width_type=h:width=1800,${this.buildADSRFilter(dur, 0.03, dur * 0.6)}[out]`;
    } else if (effect === 'handling' || variant === 'handling' || subVariant.includes('keys') || subVariant.includes('coin')) {
      inputArgs = ['-f', 'lavfi', '-i', `anoisesrc=c=white:d=${dur}`];
      filterComplex = `highpass=f=5500,tremolo=f=18:d=0.9,${this.buildADSRFilter(dur, 0.005, dur * 0.7)}[out]`;
    } else if (effect === 'typing' || variant === 'typing' || subVariant.includes('keyboard')) {
      inputArgs = ['-f', 'lavfi', '-i', `anoisesrc=c=pink:d=${dur}`];
      filterComplex = `bandpass=f=4500:width_type=h:width=2000,${this.buildADSRFilter(dur, 0.002, dur * 0.9)}[out]`;
    } else {
      inputArgs = ['-f', 'lavfi', '-i', `anoisesrc=c=pink:d=${dur}`];
      filterComplex = `lowpass=f=1500,${this.buildADSRFilter(dur, 0.01, dur * 0.5)}[out]`;
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
      category: 'foley',
      duration: dur,
      engine: 'ffmpeg_procedural',
      qualityGrade: 'studio_dsp'
    });

    return { audioPath, jsonPath };
  }
}
