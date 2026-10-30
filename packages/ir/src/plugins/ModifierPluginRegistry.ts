import type {
  IVideoPluginStrategy,
  PluginTargetPhase,
  ClipRenderContext,
  StreamRenderContext,
  MasterCompositeContext,
  AudioProcessContext,
} from './IVideoPluginStrategy';

export type {
  IVideoPluginStrategy,
  PluginTargetPhase,
  ClipRenderContext,
  StreamRenderContext,
  MasterCompositeContext,
  AudioProcessContext,
};

export interface ModifierContext {
  targetType: 'track' | 'sequence';
  targetEntity: ResolvedTrack | ResolvedSequence;
  timeline: ReadonlyMap<string, ResolvedSequence>;
  assets?: Record<string, { src: string; type?: string }>;
  fps: number;
  canvas: { width: number; height: number };
  state?: Record<string, unknown>;
}

import type { ModifierNode, ResolvedSequence, ResolvedTrack, SequenceType, TrackType } from '../types/VideoIR';
import type { ModifierTargetScope, EntityModifierContext, EntityModifierCheckResult } from '../types/modifiers';

export const STANDALONE_SEQUENCE_ALLOWED_MODIFIERS: ReadonlySet<string> = new Set([
  'transform',
  'motion/gsap',
  'overlay/blend_mode',
  'transition/crossfade',
  'transition/wipe',
  'transition/push',
  'transition/zoom',
  'transition/dip',
  'transition/glitch',
  'transition/light_leak',
  'transition/radial_wipe',
  'transition/iris',
  'editorial/transition',
  'transition',
]);

export interface ModifierMatrixEntry {
  type: string;
  name: string;
  category: string;
  targetScope: ModifierTargetScope;
  allowedSequenceTypes?: readonly SequenceType[];
  isUniversal: boolean;
  supportedTrackTypes: readonly TrackType[];
  instancePolicy: 'single' | 'multiple';
  targetPhase?: PluginTargetPhase;
}

export type ParamFieldType =
  | 'number'
  | 'boolean'
  | 'string'
  | 'select'
  | 'color'
  | 'curve'
  | 'motion_lifecycle'
  | 'shader_group'
  | 'karaoke_group'
  | 'sfx_actions'
  | 'regions_array'
  | 'vision_depth_strategy'
  | 'vision_segmentation_strategy'
  | 'light_vector'
  | 'group';

export interface ParamFieldDescriptor {
  key: string;
  label: string;
  type: ParamFieldType;
  description?: string;
  defaultValue?: any;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: Array<{ label: string; value: string | number }>;
  presets?: Array<{ name: string; hex: string }>;
  fields?: Record<string, ParamFieldDescriptor>;
  group?: string;
  visibleIf?: (params: Record<string, any>) => boolean;
}

export interface ModifierParameterSchema {
  displayName?: string;
  category?:
    | 'vfx'
    | 'sfx'
    | 'motion'
    | 'text'
    | 'editorial'
    | 'overlay'
    | 'shapes'
    | 'typography'
    | 'audio'
    | 'custom'
    | 'time_space';
  resetDefaults?: Record<string, any>;
  fields: Record<string, ParamFieldDescriptor>;
  groups?: Array<{ id: string; label: string }>;
}

export interface ModifierPlugin<TParams = Record<string, unknown>> {
  readonly type: string;
  readonly defaultTarget?: SequenceType | SequenceType[];
  readonly targetScope: ModifierTargetScope;
  readonly allowedSequenceTypes?: readonly SequenceType[];
  /**
   * Universal Canvas Primitive Flag:
   * When true, indicates that this modifier is an in-canvas geometric/compositing primitive
   * (e.g. transform, motion/gsap, overlay/blend_mode, transitions) universally allowed across
   * ANY visual sequence, including standalone procedural generator clips.
   * When omitted or false, the modifier is forbidden on standalone generator sequences.
   */
  readonly isUniversal?: boolean;
  /**
   * Supported track modalities: e.g. ['video'], ['audio'], ['timed_text']
   */
  readonly supportedTrackTypes?: readonly TrackType[];
  /**
   * Maximum allowed instances on a single entity ('single' | 'multiple'). Default: 'single'.
   */
  readonly instancePolicy?: 'single' | 'multiple';
  readonly targetPhase?: PluginTargetPhase;
  readonly schema?: ModifierParameterSchema;
  validate?(params: unknown): params is TParams;
  execute?(context: ModifierContext, params: TParams): Promise<void> | void;
  // Support 4-phase lifecycle methods
  renderClipSpace?(ctx: ClipRenderContext, params: TParams, state?: any): void | Promise<void>;
  renderStreamSpace?(ctx: StreamRenderContext, params: TParams, state?: any): void | Promise<void>;
  renderMasterComposite?(ctx: MasterCompositeContext, params: TParams, state?: any): void | Promise<void>;
  // Pure Float32 DSP audio processing hooks
  processAudioStream?(ctx: AudioProcessContext, buffer: Float32Array, params: TParams): void;
  processStereoStream?(ctx: AudioProcessContext, left: Float32Array, right: Float32Array, params: TParams): void;
}

/**
 * ModifierPluginRegistry:
 * Core extensible plugin registry adhering to the Open-Closed Principle (OCP).
 * Enables dynamic dispatching of VFX, SFX, editorial, and overlay modifiers
 * without modifying core compiler or rendering pipeline code.
 */
export class ModifierPluginRegistry {
  private static instance: ModifierPluginRegistry;
  private plugins: Map<string, ModifierPlugin<any>> = new Map();
  private targetCache: Map<string, ModifierPlugin<any>[]> = new Map();

  public constructor() { }

  public static getInstance(): ModifierPluginRegistry {
    if (!ModifierPluginRegistry.instance) {
      ModifierPluginRegistry.instance = new ModifierPluginRegistry();
    }
    return ModifierPluginRegistry.instance;
  }

  public static createIsolated(): ModifierPluginRegistry {
    return new ModifierPluginRegistry();
  }

  public register(plugin: ModifierPlugin<any>): void {
    this.plugins.set(plugin.type, plugin);
    this.targetCache.clear();
  }

  public get(type: string): ModifierPlugin<any> | undefined {
    return this.plugins.get(type);
  }

  public getSchema(type: string): ModifierParameterSchema | undefined {
    return this.plugins.get(type)?.schema;
  }

  public has(type: string): boolean {
    return this.plugins.has(type);
  }

  public listTypes(): string[] {
    return Array.from(this.plugins.keys());
  }

  public listPlugins(): ModifierPlugin<any>[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Dynamically queries registered modifiers applicable to a specific target scope and sequence type.
   * Results are cached for O(1) repeated lookups.
   */
  public getAvailableModifiersForTarget(
    targetScope: 'sequence' | 'track' | 'timeline',
    sequenceType?: SequenceType,
    options?: { hasStandaloneGenerator?: boolean }
  ): ModifierPlugin<any>[] {
    const hasGen = Boolean(options?.hasStandaloneGenerator);
    const cacheKey = `${targetScope}_${sequenceType ?? 'all'}_gen${hasGen}`;
    const cached = this.targetCache.get(cacheKey);
    if (cached) return cached;

    const allPlugins = this.listPlugins();
    let results: ModifierPlugin<any>[] = [];

    if (targetScope === 'timeline') {
      results = allPlugins.filter((p) => p.targetScope === 'timeline');
    } else if (targetScope === 'track') {
      results = allPlugins.filter((p) => p.targetScope === 'track');
    } else if (targetScope === 'sequence') {
      results = allPlugins.filter((p) => {
        if (p.targetScope === 'standalone') {
          if (hasGen) return false;
          if (sequenceType === 'overlay' || (sequenceType === 'audio' && p.schema?.category === 'audio')) {
            return true;
          }
          return false;
        }

        if (p.targetScope !== 'sequence') return false;

        // If sequence has a standalone generator, ONLY allow universal modifiers
        if (hasGen) {
          const isUniversal = Boolean(p.isUniversal || STANDALONE_SEQUENCE_ALLOWED_MODIFIERS.has(p.type));
          if (!isUniversal) return false;
        }

        if (sequenceType) {
          return !p.allowedSequenceTypes || p.allowedSequenceTypes.includes(sequenceType);
        }
        return true;
      });
    }

    this.targetCache.set(cacheKey, results);
    return results;
  }

  /**
   * Returns the dynamic, self-describing capability matrix for all registered plugins.
   */
  public getCapabilityMatrix(): ModifierMatrixEntry[] {
    return this.listPlugins().map((p) => ({
      type: p.type,
      name: p.schema?.displayName || p.type,
      category: p.schema?.category || 'custom',
      targetScope: p.targetScope,
      allowedSequenceTypes: p.allowedSequenceTypes,
      isUniversal: Boolean(p.isUniversal || STANDALONE_SEQUENCE_ALLOWED_MODIFIERS.has(p.type)),
      supportedTrackTypes: p.supportedTrackTypes || (p.targetScope === 'track' ? ['timed_text'] : ['video']),
      instancePolicy: p.instancePolicy || 'single',
      targetPhase: p.targetPhase,
    }));
  }

  /**
   * Queries standalone procedural generators for the Left Sidebar library.
   */
  public getGeneratorsForLibrary(category?: string): ModifierPlugin<any>[] {
    const allPlugins = this.listPlugins();
    return allPlugins.filter((p) => {
      if (p.targetScope !== 'standalone') return false;
      if (category) {
        return p.schema?.category === category;
      }
      return true;
    });
  }

  /**
   * Evaluates whether a modifier is permitted on a target track, sequence, or timeline.
   */
  public isModifierAllowedOnEntity(
    modifierType: string,
    targetContext: EntityModifierContext | { type: 'track' | 'timeline' } | { type: 'sequence'; sequenceType: SequenceType }
  ): { allowed: boolean; reason?: string } {
    const plugin = this.get(modifierType);
    if (!plugin) {
      return { allowed: false, reason: `Unknown modifier "${modifierType}"` };
    }

    const targetType = (targetContext as any).target || (targetContext as any).type;

    if (targetType === 'timeline') {
      if (plugin.targetScope === 'timeline') return { allowed: true };
      return {
        allowed: false,
        reason: `Modifier "${modifierType}" targetScope is "${plugin.targetScope}", cannot be applied to timeline`,
      };
    }

    if (targetType === 'track') {
      if (plugin.targetScope === 'track') return { allowed: true };
      return {
        allowed: false,
        reason: `Modifier "${modifierType}" targetScope is "${plugin.targetScope}", cannot be applied to track`,
      };
    }

    // Sequence targetContext
    const seqType = (targetContext as any).sequenceType;
    const hasStandaloneGenerator = Boolean((targetContext as any).hasStandaloneGenerator);
    const existingModifierTypes = (targetContext as any).existingModifierTypes as readonly string[] | undefined;

    if (plugin.targetScope === 'standalone') {
      // 1. Cannot attach a standalone generator if the sequence already has one
      if (hasStandaloneGenerator || existingModifierTypes?.some((t) => this.get(t)?.targetScope === 'standalone')) {
        return {
          allowed: false,
          reason: `Sequence already contains a standalone generator. A sequence cannot host multiple standalone generators.`,
        };
      }

      if (seqType === 'overlay' || (seqType === 'audio' && plugin.schema?.category === 'audio')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Standalone generator "${modifierType}" can only reside on overlay or audio sequences, not "${seqType}"`,
      };
    }

    if (plugin.targetScope !== 'sequence') {
      return {
        allowed: false,
        reason: `Modifier "${modifierType}" targetScope is "${plugin.targetScope}", cannot be applied to sequence`,
      };
    }

    // 2. If the sequence is a standalone generator sequence, ONLY universal modifiers are permitted!
    if (hasStandaloneGenerator || existingModifierTypes?.some((t) => this.get(t)?.targetScope === 'standalone')) {
      const isUniversal = Boolean(plugin.isUniversal || STANDALONE_SEQUENCE_ALLOWED_MODIFIERS.has(modifierType));
      if (!isUniversal) {
        return {
          allowed: false,
          reason: `Modifier "${modifierType}" cannot be applied to a standalone generator sequence. Standalone generator sequences only accept universal spatial/compositing modifiers (${Array.from(STANDALONE_SEQUENCE_ALLOWED_MODIFIERS).join(', ')}).`,
        };
      }
    }

    // 3. Check allowed sequence types
    if (plugin.allowedSequenceTypes && !plugin.allowedSequenceTypes.includes(seqType)) {
      return {
        allowed: false,
        reason: `Modifier "${modifierType}" does not permit sequence type "${seqType}" (allowed: ${plugin.allowedSequenceTypes.join(', ')})`,
      };
    }

    return { allowed: true };
  }

  /**
   * Executes a modifier node defensively with graceful degradation.
   * If a plugin is not found, logs a warning and bypasses without throwing.
   */
  public async executeModifier(
    context: ModifierContext,
    modifier: ModifierNode
  ): Promise<void> {
    const plugin = this.get(modifier.type);
    if (!plugin) {
      console.warn(`[ModifierPluginRegistry] Warning: Unknown modifier plugin "${modifier.type}". Bypassing gracefully.`);
      return;
    }

    const isCompatible =
      plugin.targetScope === 'standalone'
        ? context.targetType === 'sequence'
        : (plugin.targetScope as any) === 'both' || plugin.targetScope === context.targetType;

    if (!isCompatible) {
      console.warn(
        `[ModifierPluginRegistry] Warning: Modifier "${modifier.type}" targetScope is "${plugin.targetScope}", but applied to "${context.targetType}". Bypassing.`
      );
      return;
    }

    if (plugin.validate && !plugin.validate(modifier.params)) {
      throw new Error(`[ModifierPluginRegistry] Parameter validation failed for modifier "${modifier.type}"`);
    }

    await plugin.execute?.(context, modifier.params);
  }
}
