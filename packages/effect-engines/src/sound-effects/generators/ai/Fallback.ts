import { GeneratedSound } from '../../core/interfaces';
import { BaseSoundGenerator } from '../base';
import { Fallback as FFmpegFallback } from '../ffmpeg/Fallback';
import { PythonBackend } from '@acc/core';

export class Fallback extends BaseSoundGenerator {
  private dspFallback: FFmpegFallback;

  constructor(private aiModel: string) {
    super();
    this.dspFallback = new FFmpegFallback();
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
      return this.dspFallback.generate(effect, variant, subVariant, duration, outDir);
    }

    const { audioPath, jsonPath } = this.getOutputFilePaths(effect, variant, subVariant, duration, outDir, this.aiModel);
    const prompt = customPrompt || `Sound effect of ${effect} ${variant} ${subVariant}`;

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
        category: 'fallback',
        duration,
        engine: 'ai',
        model: this.aiModel,
        aiPrompt: prompt
      });

      return { audioPath, jsonPath };
    } catch (err: any) {
      console.warn(`[AIEngine] AI sound synthesis unavailable (${err.message}). Using DSP Fallback...`);
      return this.dspFallback.generate(effect, variant, subVariant, duration, outDir);
    }
  }
}
