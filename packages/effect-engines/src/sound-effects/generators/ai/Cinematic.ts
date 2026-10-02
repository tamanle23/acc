import { GeneratedSound } from '../../core/interfaces';
import { BaseSoundGenerator } from '../base';
import { Cinematic as FFmpegCinematic } from '../ffmpeg/Cinematic';
import { PythonBackend } from '@acc/core';

export class Cinematic extends BaseSoundGenerator {
  private dspCinematic: FFmpegCinematic;

  constructor(private aiModel: string) {
    super();
    this.dspCinematic = new FFmpegCinematic();
  }

  async generate(
    effect: string,
    variant: string,
    subVariant: string,
    duration: number,
    outDir: string,
    customPrompt?: string
  ): Promise<GeneratedSound> {
    if (process.env.NODE_ENV === 'test' || !process.env.ENABLE_PYTHON_AI) {
      return this.dspCinematic.generate(effect, variant, subVariant, duration, outDir);
    }

    const { audioPath, jsonPath } = this.getOutputFilePaths(effect, variant, subVariant, duration, outDir, this.aiModel);

    let prompt = customPrompt || 'Cinematic Hollywood trailer sound effect, ';
    if (variant === 'impact' || variant === 'hit') {
      prompt += 'massive sub drop impact, heavy bass explosion.';
    } else {
      prompt += `${variant.replace('_', ' ')} ${subVariant.replace('_', ' ')}, dramatic tension.`;
    }

    try {
      const engine = PythonBackend.getInstance();
      await engine.dispatchTask<{ file_path: string }>('audio', 'generate_sfx', {
        prompt,
        model: this.aiModel,
        duration,
        output_path: audioPath
      });

      this.writeMetadata(jsonPath, {
        effect,
        variant,
        subVariant,
        category: 'cinematic',
        duration,
        engine: 'ai',
        model: this.aiModel,
        aiPrompt: prompt
      });

      return { audioPath, jsonPath };
    } catch (err: any) {
      console.warn(`[AIEngine] Cinematic AI unavailable (${err.message}). Using DSP Synth...`);
      return this.dspCinematic.generate(effect, variant, subVariant, duration, outDir);
    }
  }
}
