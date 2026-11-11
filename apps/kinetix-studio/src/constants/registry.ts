import { BACKGROUND_GRAPHICS_CATALOG, type BackgroundGraphicItem } from './background-graphics';
import { SHADER_CATALOG } from './shaders';
import type { ShaderItem } from '@/types/shader';
import { HERO_CATALOG } from './heroes';
import type { HeroItem } from '@/types/hero';
import { SPATIAL_LAYOUTS, LAYOUT_ENGINES } from './spatial-layouts';
import type { SpatialLayoutItem, LayoutEngineType, LayoutEngineMeta } from '@/types/spatial';
import { KINETIC_TYPE_CATALOG } from './kinetic-types';
import type { KineticTypeItem } from '@/types/motion';
import { EASING_CATALOG } from './easings';
import type { EasingItem } from '@/types/motion';
import { BRAND_ARCHETYPES } from './archetypes';
import { CURATED_PALETTES } from './palettes';
import type { BrandArchetype, CuratedPalette } from '@/types/preset';
import { STAGE_SHAPES, STAGE_ASPECTS, type StageShapeItem, type StageAspectItem } from '@/engine/composition/stage-geometry';
import { SYNTH_PATTERNS, type SynthPatternDef } from '@/engine/audio-synth';

export type UniformParamType = 'number' | 'boolean' | 'select';

export interface UniformParamSchema {
  id: string;
  name: string;
  type: UniformParamType;
  default: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  unit?: string;
  description?: string;
}

/**
 * Curated Uniform Parameter Schemas for Background Graphics
 */
const DEFAULT_BACKGROUND_UNIFORMS: Record<string, UniformParamSchema[]> = {
  'halftone-dots': [
    { id: 'dotDensity', name: 'Screen Density', type: 'number', default: 24, min: 12, max: 48, step: 2, unit: 'px' },
    { id: 'contrastAngle', name: 'Screen Angle', type: 'number', default: 45, min: 0, max: 90, step: 5, unit: '°' },
  ],
  'blueprint-grid': [
    { id: 'cellSize', name: 'Grid Pitch', type: 'number', default: 32, min: 16, max: 64, step: 4, unit: 'px' },
    { id: 'reticleCadence', name: 'Crosshair Rings', type: 'boolean', default: true },
  ],
  'risograph-grain': [
    { id: 'grainDensity', name: 'Grain Stipple Density', type: 'number', default: 1.0, min: 0.2, max: 2.0, step: 0.1 },
  ],
  'topo-contours': [
    { id: 'contourSpacing', name: 'Isoline Spacing', type: 'number', default: 20, min: 10, max: 50, step: 5, unit: 'px' },
    { id: 'elevationSpeed', name: 'Harmonic Flow', type: 'number', default: 1.0, min: 0.2, max: 2.5, step: 0.1 },
  ],
  'hex-mesh': [
    { id: 'hexRadius', name: 'Honeycomb Radius', type: 'number', default: 28, min: 14, max: 56, step: 2, unit: 'px' },
  ],
  'caution-stripes': [
    { id: 'stripeWidth', name: 'Hazard Band Width', type: 'number', default: 40, min: 16, max: 80, step: 4, unit: 'px' },
  ],
};

/**
 * Curated Uniform Parameter Schemas for Ambient Shaders
 */
const DEFAULT_SHADER_UNIFORMS: Record<string, UniformParamSchema[]> = {
  'reaction-diffusion': [
    { id: 'feedRate', name: 'Feed Rate (F)', type: 'number', default: 0.054, min: 0.02, max: 0.08, step: 0.002 },
    { id: 'killRate', name: 'Kill Rate (K)', type: 'number', default: 0.062, min: 0.04, max: 0.07, step: 0.001 },
  ],
  'gravitational-lens': [
    { id: 'eventHorizonRadius', name: 'Event Horizon Scale', type: 'number', default: 1.0, min: 0.5, max: 2.0, step: 0.1 },
    { id: 'dopplerBeaming', name: 'Doppler Beaming Boost', type: 'boolean', default: true },
  ],
  'ascii-matrix-terminal': [
    { id: 'fontSize', name: 'Glyph Size', type: 'number', default: 11, min: 8, max: 20, step: 1, unit: 'px' },
    { id: 'crtFlicker', name: 'CRT Scanline Hum', type: 'boolean', default: true },
  ],
  'quantum-superposition': [
    { id: 'orbitalNodalCount', name: 'Wave Fringes', type: 'number', default: 5, min: 2, max: 10, step: 1 },
  ],
  'neon-caustics': [
    { id: 'dispersionRays', name: 'Snell Refraction Web', type: 'number', default: 8, min: 4, max: 16, step: 1 },
  ],
};

/**
 * Curated Uniform Parameter Schemas for Hero Subjects
 */
const DEFAULT_HERO_UNIFORMS: Record<string, UniformParamSchema[]> = {
  'modular-synth': [
    { id: 'cableSag', name: 'Eurorack Cable Sag', type: 'number', default: 1.0, min: 0.4, max: 1.8, step: 0.1 },
    { id: 'sequencerSpeed', name: 'LED Sequencer Clock', type: 'number', default: 1.0, min: 0.5, max: 2.0, step: 0.25 },
  ],
  'drum-machine': [
    { id: 'padGlowIntensity', name: 'Silicone Pad Backlight', type: 'number', default: 1.0, min: 0.2, max: 1.8, step: 0.1 },
  ],
  'cyber-drone': [
    { id: 'rotorBlurSpeed', name: 'Rotor Blur Cadence', type: 'number', default: 1.2, min: 0.5, max: 2.5, step: 0.1 },
    { id: 'lidarCone', name: 'Lidar Sensor Cone', type: 'boolean', default: true },
  ],
  'anamorphic-lens': [
    { id: 'flareIntensity', name: 'Blue Streak Flare', type: 'number', default: 1.0, min: 0.0, max: 2.0, step: 0.1 },
  ],
};

/**
 * Extensible Catalog Registry
 */
export class StudioCatalogRegistry {
  private backgrounds: BackgroundGraphicItem[] = [...BACKGROUND_GRAPHICS_CATALOG];
  private shaders: ShaderItem[] = [...SHADER_CATALOG];
  private heroes: HeroItem[] = [...HERO_CATALOG];
  private layouts: SpatialLayoutItem[] = [...SPATIAL_LAYOUTS];
  private kineticTypes: KineticTypeItem[] = [...KINETIC_TYPE_CATALOG];
  private easings: EasingItem[] = [...EASING_CATALOG];
  private archetypes: BrandArchetype[] = [...BRAND_ARCHETYPES];
  private palettes: CuratedPalette[] = [...CURATED_PALETTES];

  private bgUniforms: Map<string, UniformParamSchema[]> = new Map(Object.entries(DEFAULT_BACKGROUND_UNIFORMS));
  private shaderUniforms: Map<string, UniformParamSchema[]> = new Map(Object.entries(DEFAULT_SHADER_UNIFORMS));
  private heroUniforms: Map<string, UniformParamSchema[]> = new Map(Object.entries(DEFAULT_HERO_UNIFORMS));

  // Accessors
  getBackgrounds(): BackgroundGraphicItem[] {
    return this.backgrounds;
  }

  getShaders(): ShaderItem[] {
    return this.shaders;
  }

  getHeroes(): HeroItem[] {
    return this.heroes;
  }

  getLayouts(): SpatialLayoutItem[] {
    return this.layouts;
  }

  getLayoutEngines(): Record<LayoutEngineType, LayoutEngineMeta> {
    return LAYOUT_ENGINES;
  }

  getLayoutEngine(type: LayoutEngineType): LayoutEngineMeta | undefined {
    return LAYOUT_ENGINES[type];
  }

  getKineticTypes(): KineticTypeItem[] {
    return this.kineticTypes;
  }

  getEasings(): EasingItem[] {
    return this.easings;
  }

  getArchetypes(): BrandArchetype[] {
    return this.archetypes;
  }

  getStageShapes(): StageShapeItem[] {
    return STAGE_SHAPES;
  }

  getStageAspects(): StageAspectItem[] {
    return STAGE_ASPECTS;
  }

  getPalettes(): CuratedPalette[] {
    return this.palettes;
  }

  // Lookup helpers
  getBackground(id: string): BackgroundGraphicItem | undefined {
    return this.backgrounds.find((b) => b.id === id);
  }

  getShader(id: string): ShaderItem | undefined {
    return this.shaders.find((s) => s.id === id);
  }

  getHero(id: string): HeroItem | undefined {
    return this.heroes.find((h) => h.id === id);
  }

  getLayout(id: string): SpatialLayoutItem | undefined {
    return this.layouts.find((l) => l.id === id);
  }

  getArchetype(id: string): BrandArchetype | undefined {
    return this.archetypes.find((a) => a.id === id);
  }

  getSynthPatterns(): SynthPatternDef[] {
    return SYNTH_PATTERNS;
  }

  // Uniform Schemas
  getBackgroundUniforms(graphicId: string): UniformParamSchema[] {
    return this.bgUniforms.get(graphicId) ?? [];
  }

  getShaderUniforms(shaderId: string): UniformParamSchema[] {
    return this.shaderUniforms.get(shaderId) ?? [];
  }

  getHeroUniforms(heroId: string): UniformParamSchema[] {
    return this.heroUniforms.get(heroId) ?? [];
  }

  // Dynamic Registration
  registerBackground(item: BackgroundGraphicItem, uniforms?: UniformParamSchema[]): void {
    const idx = this.backgrounds.findIndex((b) => b.id === item.id);
    if (idx >= 0) {
      this.backgrounds[idx] = item;
    } else {
      this.backgrounds.push(item);
    }
    if (uniforms) {
      this.bgUniforms.set(item.id, uniforms);
    }
  }

  registerShader(item: ShaderItem, uniforms?: UniformParamSchema[]): void {
    const idx = this.shaders.findIndex((s) => s.id === item.id);
    if (idx >= 0) {
      this.shaders[idx] = item;
    } else {
      this.shaders.push(item);
    }
    if (uniforms) {
      this.shaderUniforms.set(item.id, uniforms);
    }
  }

  registerHero(item: HeroItem, uniforms?: UniformParamSchema[]): void {
    const idx = this.heroes.findIndex((h) => h.id === item.id);
    if (idx >= 0) {
      this.heroes[idx] = item;
    } else {
      this.heroes.push(item);
    }
    if (uniforms) {
      this.heroUniforms.set(item.id, uniforms);
    }
  }

  registerArchetype(item: BrandArchetype): void {
    const idx = this.archetypes.findIndex((a) => a.id === item.id);
    if (idx >= 0) {
      this.archetypes[idx] = item;
    } else {
      this.archetypes.push(item);
    }
  }
}

// Global Singleton
export const studioRegistry = new StudioCatalogRegistry();
