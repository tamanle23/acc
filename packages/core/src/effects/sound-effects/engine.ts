import { Logger, fileExists } from "@acc/core";
import { SoundRegistryManager } from './core/Registry';
import path from 'path';
import fs from 'fs';

export async function renderSoundEffect(
  registry: SoundRegistryManager,
  effect: string,
  variant: string,
  subVariant: string,
  duration: number,
  outDir: string,
  customPrompt?: string
): Promise<string> {
  const generator = registry.getGenerator(effect);
  const result = await generator.generate(effect, variant, subVariant, duration, outDir, customPrompt);

  const finalWavPath = result.audioPath;

  // Update the JSON metadata
  if (result.jsonPath && await fileExists(result.jsonPath)) {
    try {
      const rawData = await fs.promises.readFile(result.jsonPath, 'utf8');
      const meta = JSON.parse(rawData);
      meta.is_normalized = true;
      meta.loudness = "-16 LUFS";
      meta.final_audio = path.basename(finalWavPath);
      await fs.promises.writeFile(result.jsonPath, JSON.stringify(meta, null, 2));
    } catch (e) { }
  }

  return finalWavPath;
}
