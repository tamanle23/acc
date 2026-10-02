import { ISoundGenerator, SoundCompositeConfig, SoundPresetCatalog } from './interfaces';
import { SmartRouter, CategoryMatchRule } from './router';

// --- FFmpeg Generators ---
import { UI as UIFFmpeg } from '../generators/ffmpeg/UI';

// --- AI Generators ---
import { Cinematic as CinematicAI } from '../generators/ai/Cinematic';
import { SciFi as SciFiAI } from '../generators/ai/SciFi';
import { Fallback as FallbackAI } from '../generators/ai/Fallback';

// --- Library Generators ---
import { GenericLibrary } from '../generators/library/GenericLibrary';

export class RegistryManager {
  private router: SmartRouter;
  private genericLibraryInstance: GenericLibrary;
  private ffmpegUIGenerator: UIFFmpeg;
  private aiFallback: FallbackAI;

  private catalog: SoundPresetCatalog = {
    ui: {
      hover: ['subtle_pop', 'soft_chirp', 'glass_haptic'],
      click: ['button_press', 'plastic_pop', 'mechanical_switch'],
      success: ['chime', 'modern_arpeggio', 'rising_major'],
      error: ['descending_buzz', 'triple_alert', 'negative_beep'],
      pickup: ['coin', 'gem_collect', 'power_up'],
      jump: ['arcade_bounce', 'boing', 'spring']
    },
    cinematic: {
      transition: ['whoosh', 'sub_passby', 'reverb_riser'],
      impact: ['sub_drop', 'trailer_hit', 'metal_boom'],
      tension: ['braam', 'drone_pulse', 'clock_shepard'],
      riser: ['white_noise_lift', 'pitch_sweep', 'dramatic_build'],
      stinger: ['horror_shock', 'brass_stab', 'metallic_sting']
    },
    scifi: {
      laser: ['pew_blast', 'pulse_cannon', 'plasma_rifle'],
      warp_drive: ['hyperdrive_charge', 'quantum_hum', 'singularity'],
      glitch: ['digital_corrupt', 'data_burst', 'cyber_flicker'],
      forcefield: ['energy_shield', 'barrier_hum', 'deflector_hit']
    },
    foley: {
      footsteps: ['heavy_boots', 'sneakers_wood', 'grass_gravel'],
      cloth: ['jacket_rustle', 'denim_swish', 'curtain_pull'],
      handling: ['keys_jingle', 'coin_drop', 'glass_clink'],
      typing: ['mechanical_keyboard', 'laptop_keys', 'typewriter']
    },
    diegetic: {
      weather: ['rain', 'heavy_storm', 'howling_wind'],
      water: ['ocean_waves', 'river_stream', 'drip_echo'],
      urban: ['city_traffic', 'cafe', 'subway_ambient'],
      weapon: ['gunshot_echo', 'blade_unsheathe', 'arrow_pass']
    },
    fauna: {
      apex_predator: ['lion_roar', 'wolf_howl', 'bear_growl'],
      birds_of_prey: ['vulture_screech', 'eagle_call', 'falcon_screech'],
      livestock: ['pig_squeal', 'cow_moo', 'rooster_crow'],
      marine: ['whale_song', 'dolphin_click'],
      insects: ['bee_swarm', 'cicada_buzz']
    }
  };

  private composites: Record<string, SoundCompositeConfig> = {
    'kaiju_roar': {
      name: 'kaiju_roar',
      category: 'creature',
      layers: [
        { effect: 'avian', variant: 'birds_of_prey', subVariant: 'vulture_screech', duration: 3, delay: 0 },
        { effect: 'domestic_farm', variant: 'livestock', subVariant: 'pig_squeal', duration: 3, delay: 0.2 },
        { effect: 'wild_terrestrial', variant: 'apex_predator', subVariant: 'lion_roar', duration: 4, delay: 0.5 }
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
    this.genericLibraryInstance = new GenericLibrary();
    this.ffmpegUIGenerator = new UIFFmpeg();
    this.aiFallback = new FallbackAI(this.aiModel);

    this.router = new SmartRouter(this.aiFallback);

    // Rule 1: UI Procedural
    this.router.registerRule(
      new CategoryMatchRule(
        'UI Procedural Synth',
        ['ui', 'click', 'feedback', 'hover', 'success', 'error', 'pickup', 'jump'],
        () => this.ffmpegUIGenerator
      )
    );

    // Rule 2: Freesound Library (Acoustic / Environmental / Foley)
    this.router.registerRule(
      new CategoryMatchRule(
        'Library Freesound Engine',
        ['fauna', 'diegetic', 'weather', 'water', 'urban', 'foley', 'cloth', 'footsteps', 'handling', 'domestic_farm', 'avian', 'wild_terrestrial'],
        () => this.genericLibraryInstance
      )
    );

    // Rule 3: AI Model Generators
    const cinematicAI = new CinematicAI(this.aiModel);
    const sciFiAI = new SciFiAI(this.aiModel);

    this.router.registerRule(
      new CategoryMatchRule(
        'Cinematic AI Engine',
        ['cinematic', 'transition', 'impact', 'tension', 'riser', 'stinger'],
        () => cinematicAI
      )
    );

    this.router.registerRule(
      new CategoryMatchRule(
        'SciFi AI Engine',
        ['scifi', 'laser', 'warp_drive', 'glitch', 'forcefield'],
        () => sciFiAI
      )
    );
  }

  public getGenerator(effect: string): ISoundGenerator {
    return this.router.route(effect);
  }

  public getCompositeConfig(name: string): SoundCompositeConfig {
    const config = this.composites[name];
    if (!config) {
      throw new Error(`Composite effect '${name}' not found in registry.`);
    }
    return config;
  }

  public registerComposite(config: SoundCompositeConfig): void {
    this.composites[config.name] = config;
  }

  public getAvailableComposites(): string[] {
    return Object.keys(this.composites);
  }

  public getAvailableEffects(): string[] {
    return Object.keys(this.catalog);
  }

  public getAvailableVariants(effect: string): string[] {
    const eff = effect.toLowerCase();
    if (this.catalog[eff]) {
      return Object.keys(this.catalog[eff]);
    }
    return ['hover', 'click', 'success', 'impact', 'transition'];
  }

  public getAvailableSubVariants(effect: string, variant: string): string[] {
    const eff = effect.toLowerCase();
    const varName = variant.toLowerCase();
    if (this.catalog[eff] && this.catalog[eff][varName]) {
      return this.catalog[eff][varName];
    }
    return ['default_subvariant'];
  }
}
