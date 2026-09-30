import { ISoundGenerator, GeneratedSound } from '../../core/interfaces';
import { PythonBackend } from '../../../ai-backend/python/PythonBackend';
import path from 'path';

export class Foley implements ISoundGenerator {
   constructor(private aiModel: string) { }

   async generate(effect: string, variant: string, subVariant: string, duration: number, outDir: string, customPrompt?: string): Promise<GeneratedSound> {
      const fileName = `${effect}_${variant}_${subVariant}_${duration}s_${this.aiModel}`;
      const audioPath = path.join(outDir, `${fileName}.wav`);
      const jsonPath = path.join(outDir, `${fileName}.json`);

      let prompt = customPrompt || 'High quality foley recording of ';

      if (variant === 'footsteps' || effect === 'footsteps') {
         prompt += `footsteps walking, ${subVariant.replace('_', ' ')} texture, realistic acoustics.`;
      } else if (variant === 'cloth' || effect === 'cloth') {
         prompt += `cloth movement, ${subVariant.replace('_', ' ')} rustling, close up foley.`;
      } else if (variant === 'handling' || effect === 'handling') {
         prompt += `handling an object, ${subVariant.replace('_', ' ')}, crisp foley recording.`;
      } else if (variant === 'typing' || effect === 'typing') {
         prompt += `typing on a ${subVariant.replace('_', ' ')} keyboard, close mic.`;
      } else if (variant === 'liquid' || effect === 'liquid') {
         prompt += `liquid ${subVariant.replace('_', ' ')}, splashing, realistic sound.`;
      } else {
         prompt += `${variant} ${subVariant}`;
      }

      const engine = PythonBackend.getInstance();
      await engine.dispatchTask<{ file_path: string }>('audio', 'generate_sfx', { prompt, model: this.aiModel, duration, output_path: audioPath });

      const metadata = { effect, variant, subVariant, category: 'foley', duration, engine: 'ai', model: this.aiModel, aiPrompt: prompt };
      require('fs').writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));

      return { audioPath, jsonPath };
   }
}





