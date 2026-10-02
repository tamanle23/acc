export interface SoundEffectMetadata {
  effect: string;
  variant: string;
  subVariant: string;
  category: string;
  ffmpegFilters: string[];
  durationMultiplier?: number;
}

export interface GeneratedSound {
  audioPath: string;
  jsonPath: string;
}

export interface ISoundGenerator {
  generate(
    effect: string,
    variant: string,
    subVariant: string,
    duration: number,
    outDir: string,
    customPrompt?: string
  ): Promise<GeneratedSound>;
}

export interface SoundCompositeLayer {
  effect: string;
  variant: string;
  subVariant: string;
  duration?: number;
  delay?: number;
  role?: 'foreground' | 'background';
}

export interface SoundCompositeConfig {
  name: string;
  category: string;
  layers: SoundCompositeLayer[];
}

export interface ISmartRouterRule {
  name: string;
  matches(effect: string): boolean;
  getGenerator(effect: string): ISoundGenerator;
}

export interface ISmartRouter {
  route(effect: string): ISoundGenerator;
  registerRule(rule: ISmartRouterRule): void;
}

export interface SoundPresetCatalog {
  [effect: string]: {
    [variant: string]: string[]; // array of subVariants
  };
}
