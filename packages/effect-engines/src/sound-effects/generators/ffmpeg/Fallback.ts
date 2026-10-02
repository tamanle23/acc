import { GeneratedSound } from '../../core/interfaces';
import { BaseFFmpegGenerator } from '../base';

export class Fallback extends BaseFFmpegGenerator {
  async generate(
    effect: string,
    variant: string,
    subVariant: string,
    duration: number,
    outDir: string
  ): Promise<GeneratedSound> {
    const { audioPath, jsonPath } = this.getOutputFilePaths(effect, variant, subVariant, duration, outDir);
    const dur = Math.max(duration, 0.1);

    const inputArgs = ['-f', 'lavfi', '-i', `sine=f=440:d=${dur}`];
    const filterComplex = `${this.buildADSRFilter(dur, 0.01, dur * 0.5)}[out]`;

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
      category: 'generic',
      duration: dur,
      engine: 'ffmpeg_procedural_fallback',
      qualityGrade: 'studio_dsp'
    });

    return { audioPath, jsonPath };
  }
}
