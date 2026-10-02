import { GeneratedSound } from '../../core/interfaces';
import { BaseFFmpegGenerator } from '../base';

export class Fauna extends BaseFFmpegGenerator {
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

    if (subVariant.includes('screech') || subVariant.includes('vulture')) {
      inputArgs = ['-f', 'lavfi', '-i', `anoisesrc=c=pink:d=${dur}`];
      filterComplex = `bandpass=f=2600:width_type=h:width=1200,tremolo=f=14:d=0.8,vibrato=f=8:d=0.5,${this.buildADSRFilter(dur, 0.05, dur * 0.5)}[out]`;
    } else if (subVariant.includes('squeal') || subVariant.includes('pig')) {
      inputArgs = ['-f', 'lavfi', '-i', `sine=f=850:d=${dur}`];
      filterComplex = `vibrato=f=18:d=0.9,tremolo=f=10:d=0.7,${this.buildADSRFilter(dur, 0.02, dur * 0.6)}[out]`;
    } else if (subVariant.includes('roar') || subVariant.includes('lion') || subVariant.includes('bear')) {
      inputArgs = ['-f', 'lavfi', '-i', `anoisesrc=c=brown:d=${dur}`];
      filterComplex = `lowpass=f=350,tremolo=f=3.5:d=0.85,aecho=0.8:0.88:80:0.4,${this.buildADSRFilter(dur, 0.1, dur * 0.5)}[out]`;
    } else if (subVariant.includes('buzz') || subVariant.includes('bee') || subVariant.includes('cicada')) {
      inputArgs = ['-f', 'lavfi', '-i', `sine=f=220:d=${dur}`];
      filterComplex = `tremolo=f=45:d=0.6,vibrato=f=5:d=0.3,${this.buildADSRFilter(dur, 0.1, 0.2)}[out]`;
    } else if (variant === 'avian' || subVariant.includes('birds') || subVariant.includes('eagle')) {
      inputArgs = ['-f', 'lavfi', '-i', `sine=f=3200:d=${dur}`];
      filterComplex = `vibrato=f=12:d=0.8,tremolo=f=6:d=0.6,${this.buildADSRFilter(dur, 0.05, dur * 0.5)}[out]`;
    } else {
      inputArgs = ['-f', 'lavfi', '-i', `sine=f=180:d=${dur}`];
      filterComplex = `tremolo=f=8:d=0.5,${this.buildADSRFilter(dur, 0.05, 0.2)}[out]`;
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
      category: 'fauna',
      duration: dur,
      engine: 'ffmpeg_procedural',
      qualityGrade: 'studio_dsp'
    });

    return { audioPath, jsonPath };
  }
}
