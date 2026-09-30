import { ISoundGenerator, GeneratedSound } from '../../core/interfaces';
import { PythonBackend } from '../../../ai-backend/python/PythonBackend';
import path from 'path';

export class SciFi implements ISoundGenerator {
  constructor(private aiModel: string) { }

  async generate(effect: string, variant: string, subVariant: string, duration: number, outDir: string, customPrompt?: string): Promise<GeneratedSound> {
    const fileName = `${effect}_${variant}_${subVariant}_${duration}s_${this.aiModel}`;
    const audioPath = path.join(outDir, `${fileName}.wav`);
    const jsonPath = path.join(outDir, `${fileName}.json`);

    let prompt = customPrompt || 'Cinematic sci-fi sound design, ';

    if (variant === 'laser' || subVariant.includes('blast')) {
      prompt += `laser blaster firing, ${subVariant.replace('_', ' ')}, futuristic weapons, synthesized energy.`;
    } else if (variant === 'warp_drive' || subVariant.includes('warp')) {
      prompt += `warp drive engine, ${subVariant.replace('_', ' ')}, heavy sub bass hum, powering up space ship.`;
    } else if (variant === 'glitch' || subVariant.includes('error')) {
      prompt += `computer system glitch, ${subVariant.replace('_', ' ')}, digital static error, cyberpunk interface.`;
    } else if (variant === 'forcefield') {
      prompt += `energy forcefield hum, glowing electricity, continuous loop.`;
    } else {
      prompt += `${variant} ${subVariant}`;
    }

    const engine = PythonBackend.getInstance();
    await engine.dispatchTask<{ file_path: string }>('audio', 'generate_sfx', { prompt, model: this.aiModel, duration, output_path: audioPath });

    const metadata = { effect, variant, subVariant, category: 'scifi', duration, engine: 'ai', model: this.aiModel, aiPrompt: prompt };
    require('fs').writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));

    return { audioPath, jsonPath };
  }
}





