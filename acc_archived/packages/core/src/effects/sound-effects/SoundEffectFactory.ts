export type SFXCategory = 'foley' | 'cinematic' | 'ui' | 'diegetic';

export interface SoundEffectMarker {
  id: string;
  category: SFXCategory;
  audioPath: string;
  offsetMs: number;
  durationMs: number;
  volume: number;
}

export class SoundEffectFactory {
  public static createSoundEffectMarker(
    id: string,
    category: SFXCategory,
    audioPath: string,
    offsetMs: number,
    durationMs = 1500,
    volume = 0.8
  ): SoundEffectMarker {
    return {
      id,
      category,
      audioPath,
      offsetMs,
      durationMs,
      volume: Math.min(1.0, Math.max(0.0, volume)),
    };
  }

  public static createFoleyPreset(
    preset: 'footsteps' | 'whoosh' | 'impact' | 'ui_click',
    offsetMs: number
  ): SoundEffectMarker {
    const audioPathMap: Record<string, string> = {
      footsteps: 'assets/sfx/foley_footsteps.wav',
      whoosh: 'assets/sfx/whoosh_cinematic.wav',
      impact: 'assets/sfx/deep_impact.wav',
      ui_click: 'assets/sfx/ui_click_soft.wav',
    };

    const categoryMap: Record<string, SFXCategory> = {
      footsteps: 'foley',
      whoosh: 'cinematic',
      impact: 'cinematic',
      ui_click: 'ui',
    };

    return this.createSoundEffectMarker(
      `sfx_${preset}_${Date.now()}`,
      categoryMap[preset] || 'foley',
      audioPathMap[preset] || 'assets/sfx/default.wav',
      offsetMs
    );
  }
}
