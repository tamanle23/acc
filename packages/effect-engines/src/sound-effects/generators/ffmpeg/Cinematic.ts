import { GeneratedSound } from '../../core/interfaces';
import { BaseFFmpegGenerator } from '../base';

export class Cinematic extends BaseFFmpegGenerator {
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

    if (variant === 'transition' || variant === 'whoosh' || subVariant.includes('whoosh')) {
      inputArgs = ['-f', 'lavfi', '-i', `anoisesrc=c=pink:d=${dur}`];
      filterComplex = `bandpass=f=4000:width_type=h:width=2500,flanger=delay=4:depth=10:regen=30:speed=6,${this.buildADSRFilter(dur, dur * 0.7, dur * 0.3)}[out]`;
    } else if (variant === 'impact' || variant === 'hit' || subVariant.includes('sub_drop') || subVariant.includes('boom')) {
      inputArgs = ['-f', 'lavfi', '-i', `sine=f=45:d=${dur}`];
      filterComplex = `lowpass=f=180,tremolo=f=8:d=0.4,aecho=0.8:0.9:100:0.5,${this.buildADSRFilter(dur, 0.005, dur * 0.8)}[out]`;
    } else if (variant === 'tension' || variant === 'braam' || subVariant.includes('braam')) {
      inputArgs = ['-f', 'lavfi', '-i', `sine=f=55:d=${dur}`];
      filterComplex = `chorus=0.8:0.9:50:0.5:0.3:2,tremolo=f=6:d=0.7,flanger=delay=8:speed=1.5,aecho=0.8:0.9:120:0.6,${this.buildADSRFilter(dur, 0.2, 0.5)}[out]`;
    } else if (variant === 'riser' || subVariant.includes('riser') || subVariant.includes('build')) {
      inputArgs = ['-f', 'lavfi', '-i', `anoisesrc=c=white:d=${dur}`];
      filterComplex = `highpass=f=1200,flanger=delay=15:depth=12:regen=40:speed=3,${this.buildADSRFilter(dur, dur * 0.85, dur * 0.15)}[out]`;
    } else if (variant === 'stinger' || subVariant.includes('shock') || subVariant.includes('sting')) {
      inputArgs = ['-f', 'lavfi', '-i', `sine=f=1800:d=${dur}`];
      filterComplex = `tremolo=f=15:d=0.8,aecho=0.8:0.9:60:0.5,${this.buildADSRFilter(dur, 0.005, dur * 0.7)}[out]`;
    } else {
      inputArgs = ['-f', 'lavfi', '-i', `sine=f=100:d=${dur}`];
      filterComplex = `${this.buildADSRFilter(dur, 0.05, dur * 0.5)}[out]`;
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
      category: 'cinematic',
      duration: dur,
      engine: 'ffmpeg_procedural',
      qualityGrade: 'studio_dsp'
    });

    return { audioPath, jsonPath };
  }
}
