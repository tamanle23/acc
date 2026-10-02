import { GeneratedSound } from '../../core/interfaces';
import { BaseFFmpegGenerator } from '../base';

export class UI extends BaseFFmpegGenerator {
  async generate(
    effect: string,
    variant: string,
    subVariant: string,
    duration: number,
    outDir: string
  ): Promise<GeneratedSound> {
    const { audioPath, jsonPath } = this.getOutputFilePaths(effect, variant, subVariant, duration, outDir);

    let inputArgs: string[] = [];
    let filterComplex = '';

    const dur = Math.min(Math.max(duration, 0.05), 5.0);

    // Modern & Retro UI Synthesizers
    if (variant === 'hover') {
      inputArgs = ['-f', 'lavfi', '-i', `sine=f=1600:d=${dur}`];
      filterComplex = `vibrato=f=12:d=0.3,highpass=f=800,${this.buildADSRFilter(dur, 0.005, dur * 0.8)}[out]`;
    } else if (variant === 'click') {
      inputArgs = ['-f', 'lavfi', '-i', `anoisesrc=c=pink:d=${dur}`];
      filterComplex = `bandpass=f=2800:width_type=h:width=1200,${this.buildADSRFilter(dur, 0.002, dur * 0.9)}[out]`;
    } else if (variant === 'success') {
      inputArgs = ['-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo:d=${dur}`];
      filterComplex = `sine=f=523.25:d=${dur}[c];sine=f=659.25:d=${dur}[e];sine=f=783.99:d=${dur}[g];sine=f=1046.50:d=${dur}[c2];` +
                      `[c][e][g][c2]amix=inputs=4,tremolo=f=5:d=0.3,aecho=0.8:0.88:40:0.3,${this.buildADSRFilter(dur, 0.01, dur * 0.4)}[out]`;
    } else if (variant === 'error') {
      inputArgs = ['-f', 'lavfi', '-i', `aevalsrc='sgn(sin(2*PI*160*t))+0.5*sgn(sin(2*PI*220*t))':d=${dur}`];
      filterComplex = `lowpass=f=1200,tremolo=f=10:d=0.6,${this.buildADSRFilter(dur, 0.01, dur * 0.5)}[out]`;
    } else if (variant === 'pickup') {
      inputArgs = ['-f', 'lavfi', '-i', `aevalsrc='sgn(sin(2*PI*(1000*t + 2500*t*t)))':d=${dur}`];
      filterComplex = `bandpass=f=2500:width_type=h:width=1500,${this.buildADSRFilter(dur, 0.005, dur * 0.5)}[out]`;
    } else if (variant === 'jump') {
      inputArgs = ['-f', 'lavfi', '-i', `aevalsrc='sgn(sin(2*PI*(350*t + 1200*t*t)))':d=${dur}`];
      filterComplex = `lowpass=f=3000,${this.buildADSRFilter(dur, 0.01, dur * 0.5)}[out]`;
    } else if (variant === 'laser') {
      inputArgs = ['-f', 'lavfi', '-i', `aevalsrc='sgn(sin(2*PI*(2200*t - 3800*t*t)))':d=${dur}`];
      filterComplex = `flanger=delay=3:depth=5:speed=8,${this.buildADSRFilter(dur, 0.005, dur * 0.7)}[out]`;
    } else {
      inputArgs = ['-f', 'lavfi', '-i', `sine=f=880:d=${dur}`];
      filterComplex = `${this.buildADSRFilter(dur, 0.01, dur * 0.5)}[out]`;
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
      category: 'ui',
      duration: dur,
      engine: 'ffmpeg_procedural',
      is_procedural_synth: true,
      qualityGrade: 'studio_dsp'
    });

    return { audioPath, jsonPath };
  }
}
