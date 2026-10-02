import { GeneratedSound } from '../../core/interfaces';
import { BaseSoundGenerator } from '../base';
import { FreesoundClient } from '@acc/core';
import { FAUNA_DICTIONARY } from '../ai/Fauna';
import { Fauna } from '../ffmpeg/Fauna';
import { Foley } from '../ffmpeg/Foley';
import { Diegetic } from '../ffmpeg/Diegetic';

export class GenericLibrary extends BaseSoundGenerator {
  private client: FreesoundClient;
  private proceduralFauna: Fauna;
  private proceduralFoley: Foley;
  private proceduralDiegetic: Diegetic;

  constructor() {
    super();
    this.client = new FreesoundClient();
    this.proceduralFauna = new Fauna();
    this.proceduralFoley = new Foley();
    this.proceduralDiegetic = new Diegetic();
  }

  async generate(
    effect: string,
    variant: string,
    subVariant: string,
    duration: number,
    outDir: string,
    customPrompt?: string
  ): Promise<GeneratedSound> {
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
      searchQuery = `${effect} ${variant.replace(/_/g, ' ')} ${subVariant.replace(/_/g, ' ')}`;
    }

    if (this.client.hasApiKey()) {
      try {
        const { audioPath: baseAudioPath, jsonPath } = this.getOutputFilePaths(
          effect,
          variant,
          subVariant,
          duration,
          outDir,
          'library'
        );
        const mp3Path = await this.client.fetchSound(searchQuery, duration, baseAudioPath.replace(/\.wav$/, ''));

        this.writeMetadata(jsonPath, {
          effect,
          variant,
          subVariant,
          category: effect,
          duration,
          engine: 'freesound_library',
          searchQuery
        });

        return { audioPath: mp3Path, jsonPath };
      } catch (err: any) {
        console.warn(`[LibraryEngine] Freesound API call failed (${err.message}). Falling back to DSP synth...`);
      }
    } else {
      console.log(`[LibraryEngine] FREESOUND_API_KEY missing. Routing to Procedural DSP Fallback...`);
    }

    // Fallback to procedural DSP generator
    if (effect === 'fauna') {
      return this.proceduralFauna.generate(effect, variant, subVariant, duration, outDir);
    } else if (['foley', 'cloth', 'footsteps', 'handling'].includes(effect)) {
      return this.proceduralFoley.generate(effect, variant, subVariant, duration, outDir);
    } else {
      return this.proceduralDiegetic.generate(effect, variant, subVariant, duration, outDir);
    }
  }
}
