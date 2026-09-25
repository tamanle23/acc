import fs from 'fs';
import path from 'path';

export interface PipelineConfig {
  format: string;
  vcodec: string;
  pix_fmt: string;
  blend_mode_recommended: string;
  background: string;
}

export interface EffectConfig {
  category: string;
  pipeline: string;
  variants: string[];
  module_path: string;
}

export interface CompositeLayer {
  effect: string;
  variant: string;
  duration: number;
}

export interface CompositeConfig {
  category: string;
  description: string;
  layers: CompositeLayer[];
}

export interface EffectsRegistry {
  pipelines: Record<string, PipelineConfig>;
  effects: Record<string, EffectConfig>;
  composites: Record<string, CompositeConfig>;
}

export class RegistryManager {
  private registry: EffectsRegistry;

  constructor() {
    const registryPath = path.resolve(process.cwd(), 'effects-registry.json');
    if (!fs.existsSync(registryPath)) {
      throw new Error(`Registry file not found at ${registryPath}`);
    }
    const rawData = fs.readFileSync(registryPath, 'utf-8');
    this.registry = JSON.parse(rawData);
  }

  public getEffectConfig(effectName: string): EffectConfig {
    const config = this.registry.effects[effectName];
    if (!config) {
      throw new Error(`Effect '${effectName}' not found in registry.`);
    }
    return config;
  }

  public getPipelineConfig(pipelineId: string): PipelineConfig {
    const config = this.registry.pipelines[pipelineId];
    if (!config) {
      throw new Error(`Pipeline '${pipelineId}' not found in registry.`);
    }
    return config;
  }

  public getCompositeConfig(compositeName: string): CompositeConfig {
    const config = this.registry.composites[compositeName];
    if (!config) {
      throw new Error(`Composite '${compositeName}' not found in registry.`);
    }
    return config;
  }

  public validate(effectName: string, variantName: string): void {
    const effect = this.getEffectConfig(effectName);
    if (!effect.variants.includes(variantName)) {
      throw new Error(
        `Variant '${variantName}' is not valid for effect '${effectName}'. Valid variants: ${effect.variants.join(', ')}`
      );
    }
  }
}
