import { ISoundGenerator, GeneratedSound } from '../../core/interfaces';
import { FreesoundClient } from '../../../core/FreesoundClient';
import { FAUNA_DICTIONARY } from '../ai/Fauna';
import path from 'path';
import fs from 'fs';

export class GenericLibrary implements ISoundGenerator {
  private client: FreesoundClient;

  constructor() {
    this.client = new FreesoundClient();
  }

  async generate(effect: string, variant: string, subVariant: string, duration: number, outDir: string, customPrompt?: string): Promise<GeneratedSound> {
    const fileName = `${effect}_${variant}_${subVariant}_${duration}s_library`;
    const audioPathBase = path.join(outDir, fileName); // without extension, client adds .mp3
    const jsonPath = path.join(outDir, `${fileName}.json`);

    let searchQuery = '';

    if (customPrompt) {
      searchQuery = customPrompt;
    } else if (effect === 'fauna') {
      const animalEntry = FAUNA_DICTIONARY[variant];
      if (animalEntry && animalEntry[subVariant]) {
        searchQuery = animalEntry[subVariant];
      } else {
        searchQuery = `${variant.replace(/_/g, ' ')} ${subVariant.replace(/_/g, ' ')} animal sound`;
      }
    } else {
      // Generic fallback for foley, cinematic, ui, etc.
      searchQuery = `${effect} ${variant.replace(/_/g, ' ')} ${subVariant.replace(/_/g, ' ')}`;
    }

    // Call the Freesound Client
    const mp3OutputPath = await this.client.fetchSound(searchQuery, duration, audioPathBase);

    const metadata = { 
      effect, 
      variant, 
      subVariant, 
      category: effect, 
      duration, 
      engine: 'library',
      searchQuery
    };
    
    fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));

    return { audioPath: mp3OutputPath, jsonPath };
  }
}
