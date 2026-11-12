import { Logger } from "@acc/core";
import { ISoundGenerator, SoundCompositeConfig } from './interfaces';
import { GenericLibrary } from '../generators/library/GenericLibrary';

export class SoundRegistryManager {
  private genericLibraryInstance: GenericLibrary;

  private composites: Record<string, SoundCompositeConfig> = {
    'kaiju_roar': {
      name: 'kaiju_roar',
      category: 'creature',
      layers: [
        { effect: 'avian', variant: 'birds_of_prey', subVariant: 'vulture_screech' },
        { effect: 'domestic_farm', variant: 'livestock', subVariant: 'pig_squeal' },
        { effect: 'wild_terrestrial', variant: 'apex_predator', subVariant: 'lion_roar' }
      ]
    },
    'cafe_notification': {
      name: 'cafe_notification',
      category: 'ui',
      layers: [
        { effect: 'diegetic', variant: 'urban', subVariant: 'cafe', duration: 10, delay: 0, role: 'background' },
        { effect: 'ui', variant: 'success', subVariant: 'chime', duration: 2, delay: 4, role: 'foreground' }
      ]
    },
    'stormy_night': {
      name: 'stormy_night',
      category: 'ambience',
      layers: [
        { effect: 'diegetic', variant: 'weather', subVariant: 'rain', duration: 10, delay: 0, role: 'background' },
        { effect: 'ui', variant: 'success', subVariant: 'chime', duration: 2, delay: 4, role: 'foreground' }
      ]
    },
    'cinematic_trailer_hit': {
      name: 'cinematic_trailer_hit',
      category: 'cinematic',
      layers: [
        { effect: 'cinematic', variant: 'transition', subVariant: 'whoosh', duration: 2, delay: 0 },
        { effect: 'cinematic', variant: 'impact', subVariant: 'sub_drop', duration: 3, delay: 2 }
      ]
    }
  };

  constructor() {
    this.genericLibraryInstance = new GenericLibrary();
  }

  /**
   * SMART ROUTING LOGIC
   * Directs acoustic generation to the media library engine.
   */
  getGenerator(effect: string): ISoundGenerator {
    const eff = effect.toLowerCase();
    Logger.info('SmartRouter', `Route '${eff}' -> Library (Freesound/Generic)`);
    return this.genericLibraryInstance;
  }

  getCompositeConfig(name: string): SoundCompositeConfig {
    const config = this.composites[name];
    if (!config) {
      throw new Error(`Composite effect '${name}' not found in registry.`);
    }
    return config;
  }
}
