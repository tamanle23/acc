import { ISoundGenerator, GeneratedSound } from '../../core/interfaces';
import { PythonBackend } from '../../../core/PythonBackend';
import path from 'path';

export class Diegetic implements ISoundGenerator {
  constructor(private aiModel: string) { }

  async generate(effect: string, variant: string, subVariant: string, duration: number, outDir: string, customPrompt?: string): Promise<GeneratedSound> {
    const fileName = `${effect}_${variant}_${subVariant}_${duration}s_${this.aiModel}`;
    const audioPath = path.join(outDir, `${fileName}.wav`);
    const jsonPath = path.join(outDir, `${fileName}.json`);

    let prompt = customPrompt || 'Environmental diegetic sound effect, ';
    prompt += `${variant.replace('_', ' ')} ${subVariant.replace('_', ' ')}, high fidelity background recording.`;

    const engine = PythonBackend.getInstance();
    await engine.dispatchTask<{ file_path: string }>('audio', 'generate_sfx', { prompt, model: this.aiModel, duration, output_path: audioPath });

    const metadata = { effect, variant, subVariant, category: 'diegetic', duration, engine: 'ai', model: this.aiModel, aiPrompt: prompt };
    require('fs').writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));

    return { audioPath, jsonPath };
  }
}





