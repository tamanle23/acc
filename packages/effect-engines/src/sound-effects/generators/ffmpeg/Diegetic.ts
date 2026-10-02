import { GeneratedSound } from '../../core/interfaces';
import { BaseFFmpegGenerator } from '../base';

export class Diegetic extends BaseFFmpegGenerator {
  async generate(
    effect: string,
    variant: string,
    subVariant: string,
    duration: number,
    outDir: string
  ): Promise<GeneratedSound> {
    const { audioPath, jsonPath } = this.getOutputFilePaths(effect, variant, subVariant, duration, outDir);
    const dur = Math.max(duration, 0.2);

    let inputArgs: string[] = [];
    let filterComplex = '';

    if (variant === 'weather' || subVariant.includes('rain') || subVariant.includes('storm')) {
      inputArgs = ['-f', 'lavfi', '-i', `anoisesrc=c=pink:d=${dur}`];
      if (subVariant.includes('heavy') || subVariant.includes('storm')) {
        filterComplex = `lowpass=f=2200,tremolo=f=0.5:d=0.3,${this.buildADSRFilter(dur, 0.2, 0.5)}[out]`;
      } else {
        filterComplex = `highpass=f=2800,lowpass=f=8000,${this.buildADSRFilter(dur, 0.2, 0.5)}[out]`;
      }
    } else if (variant === 'weather' && subVariant.includes('wind')) {
      inputArgs = ['-f', 'lavfi', '-i', `anoisesrc=c=pink:d=${dur}`];
      filterComplex = `bandpass=f=750:width_type=h:width=450,tremolo=f=0.6:d=0.7,vibrato=f=1.5:d=0.4,${this.buildADSRFilter(dur, 0.3, 0.5)}[out]`;
    } else if (variant === 'water' || subVariant.includes('ocean') || subVariant.includes('waves')) {
      inputArgs = ['-f', 'lavfi', '-i', `anoisesrc=c=pink:d=${dur}`];
      filterComplex = `lowpass=f=1100,tremolo=f=0.25:d=0.8,aecho=0.8:0.88:120:0.4,${this.buildADSRFilter(dur, 0.3, 0.5)}[out]`;
    } else if (variant === 'weapon' || subVariant.includes('gunshot') || subVariant.includes('explosion')) {
      inputArgs = ['-f', 'lavfi', '-i', `anoisesrc=c=brown:d=${dur}`];
      filterComplex = `lowpass=f=2500,${this.buildADSRFilter(dur, 0.002, dur * 0.8)}[out]`;
    } else if (variant === 'bell' || subVariant.includes('chime') || subVariant.includes('doorbell')) {
      inputArgs = ['-f', 'lavfi', '-i', `sine=f=880:d=${dur}`];
      filterComplex = `tremolo=f=4:d=0.7,aecho=0.8:0.9:60:0.4,${this.buildADSRFilter(dur, 0.01, dur * 0.7)}[out]`;
    } else {
      inputArgs = ['-f', 'lavfi', '-i', `anoisesrc=c=pink:d=${dur}`];
      filterComplex = `bandpass=f=1200:width_type=h:width=600,${this.buildADSRFilter(dur, 0.1, 0.3)}[out]`;
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
      category: 'diegetic',
      duration: dur,
      engine: 'ffmpeg_procedural',
      qualityGrade: 'studio_dsp'
    });

    return { audioPath, jsonPath };
  }
}
