import { ISoundGenerator, GeneratedSound } from '../../core/interfaces';
import { PythonBackend } from '../../../core/PythonBackend';
import path from 'path';

export class Cinematic implements ISoundGenerator {
  constructor(private aiModel: string) { }

  async generate(effect: string, variant: string, subVariant: string, duration: number, outDir: string, customPrompt?: string): Promise<GeneratedSound> {
    const fileName = `${effect}_${variant}_${subVariant}_${duration}s_${this.aiModel}`;
    const audioPath = path.join(outDir, `${fileName}.wav`);
    const jsonPath = path.join(outDir, `${fileName}.json`);

    let prompt = customPrompt || 'Cinematic Hollywood trailer sound effect, ';
    if (variant === 'impact' || variant === 'hit') {
      prompt += 'massive sub drop impact, heavy bass explosion.';
    } else {
      prompt += `${variant.replace('_', ' ')} ${subVariant.replace('_', ' ')}, dramatic tension.`;
    }

    const engine = PythonBackend.getInstance();
    await engine.dispatchTask<{ file_path: string }>('audio', 'generate_sfx', { prompt, model: this.aiModel, duration, output_path: audioPath });

    const metadata = { effect, variant, subVariant, category: 'cinematic', duration, engine: 'ai', model: this.aiModel, aiPrompt: prompt };
    require('fs').writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));

    return { audioPath, jsonPath };
  }
}





