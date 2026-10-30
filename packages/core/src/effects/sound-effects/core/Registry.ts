import { Logger } from "@acc/core";
import { ISoundGenerator, SoundCompositeConfig } from './interfaces';

// --- AI Generators ---
import { Cinematic as CinematicAI } from '../generators/ai/Cinematic';
import { SciFi as SciFiAI } from '../generators/ai/SciFi';
import { Fallback as FallbackAI } from '../generators/ai/Fallback';

// --- Library Generators ---
import { GenericLibrary } from '../generators/library/GenericLibrary';

export class SoundRegistryManager {
  private genericLibraryInstance: GenericLibrary;
  private aiGenerators: Map<string, ISoundGenerator> = new Map();
  private aiFallback: FallbackAI;

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

  constructor(private aiModel: string = 'audioldm2-base') {
    // 1. Initialize Library (For biological, physical, environmental sounds)
    this.genericLibraryInstance = new GenericLibrary();

    // 3. Initialize AI (For synthetic, creative, sci-fi, cinematic sounds)
    this.aiFallback = new FallbackAI(this.aiModel);

    // Cinematic AI
    this.aiGenerators.set('cinematic', new CinematicAI(this.aiModel));
    this.aiGenerators.set('transition', new CinematicAI(this.aiModel));
    this.aiGenerators.set('impact', new CinematicAI(this.aiModel));
    this.aiGenerators.set('tension', new CinematicAI(this.aiModel));

    // Sci-Fi AI
    this.aiGenerators.set('scifi', new SciFiAI(this.aiModel));
    this.aiGenerators.set('laser', new SciFiAI(this.aiModel));
    this.aiGenerators.set('warp_drive', new SciFiAI(this.aiModel));
    this.aiGenerators.set('glitch', new SciFiAI(this.aiModel));
    this.aiGenerators.set('forcefield', new SciFiAI(this.aiModel));

    // Custom Text-to-Audio defaults to AI
    this.aiGenerators.set('custom', this.aiFallback);
  }

  /**
   * SMART ROUTING LOGIC
   * Intelligently selects the optimal generation engine based on the acoustic nature of the effect.
   */
  getGenerator(effect: string): ISoundGenerator {
    const eff = effect.toLowerCase();


    // Rule 2: Physical & Biological Sounds -> Freesound Library API
    // AI is notoriously bad at creating realistic footsteps or animal sounds. Real recordings are superior.
    if (['fauna', 'diegetic', 'weather', 'water', 'urban', 'foley', 'cloth', 'footsteps', 'handling'].includes(eff)) {
      Logger.info('SmartRouter', `Route '${eff}' -> Library (Freesound)`);
      return this.genericLibraryInstance;
    }

    // Rule 3: Creative, Synthesized, Cinematic -> AI Model
    if (this.aiGenerators.has(eff)) {
      Logger.info('SmartRouter', `Route '${eff}' -> AI Model (${this.aiModel})`);
      return this.aiGenerators.get(eff)!;
    }

    // Fallback logic
    Logger.info('SmartRouter', `Route '${eff}' (Unrecognized) -> AI Fallback`);
    return this.aiFallback;
  }

  getCompositeConfig(name: string): SoundCompositeConfig {
    const config = this.composites[name];
    if (!config) {
      throw new Error(`Composite effect '${name}' not found in registry.`);
    }
    return config;
  }
}
