import { GeneratedSound } from '../../core/interfaces';
import { BaseSoundGenerator } from '../base';
import { SciFi as FFmpegSciFi } from '../ffmpeg/SciFi';
import { PythonBackend } from '@acc/core';

export class SciFi extends BaseSoundGenerator {
  private dspSciFi: FFmpegSciFi;

  constructor(private aiModel: string) {
    super();
    this.dspSciFi = new FFmpegSciFi();
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
      return this.dspSciFi.generate(effect, variant, subVariant, duration, outDir);
    }

    const { audioPath, jsonPath } = this.getOutputFilePaths(effect, variant, subVariant, duration, outDir, this.aiModel);

    let prompt = customPrompt || 'Sci-fi futuristic electronic sound effect, ';
    if (variant === 'laser') {
      prompt += 'high energy laser blast, crisp beam pew.';
    } else {
      prompt += `${variant.replace('_', ' ')} ${subVariant.replace('_', ' ')}, high tech synthesis.`;
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
        category: 'scifi',
        duration,
        engine: 'ai',
        model: this.aiModel,
        aiPrompt: prompt
      });

      return { audioPath, jsonPath };
    } catch (err: any) {
      console.warn(`[AIEngine] SciFi AI unavailable (${err.message}). Using DSP Synth...`);
      return this.dspSciFi.generate(effect, variant, subVariant, duration, outDir);
    }
  }
}
