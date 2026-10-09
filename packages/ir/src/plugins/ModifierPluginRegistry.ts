import type { ResolvedTrack, ResolvedSequence, ModifierNode } from '../types/VideoIR';

export interface ModifierContext {
  targetType: 'track' | 'sequence';
  targetEntity: ResolvedTrack | ResolvedSequence;
  timeline: ReadonlyMap<string, ResolvedSequence>;
  fps: number;
  canvas: { width: number; height: number };
  state?: Record<string, unknown>;
}

export interface ModifierPlugin<TParams = Record<string, unknown>> {
  readonly type: string;
  readonly targetScope: 'track' | 'sequence' | 'both';
  validate?(params: unknown): params is TParams;
  execute(context: ModifierContext, params: TParams): Promise<void> | void;
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

  private constructor() {}

  public static getInstance(): ModifierPluginRegistry {
    if (!ModifierPluginRegistry.instance) {
      ModifierPluginRegistry.instance = new ModifierPluginRegistry();
    }
    return ModifierPluginRegistry.instance;
  }

  public register(plugin: ModifierPlugin<any>): void {
    this.plugins.set(plugin.type, plugin);
  }

  public get(type: string): ModifierPlugin<any> | undefined {
    return this.plugins.get(type);
  }

  public has(type: string): boolean {
    return this.plugins.has(type);
  }

  public listTypes(): string[] {
    return Array.from(this.plugins.keys());
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

    if (plugin.targetScope !== 'both' && plugin.targetScope !== context.targetType) {
      console.warn(
        `[ModifierPluginRegistry] Warning: Modifier "${modifier.type}" targetScope is "${plugin.targetScope}", but applied to "${context.targetType}". Bypassing.`
      );
      return;
    }

    if (plugin.validate && !plugin.validate(modifier.params)) {
      throw new Error(`[ModifierPluginRegistry] Parameter validation failed for modifier "${modifier.type}"`);
    }

    await plugin.execute(context, modifier.params);
  }
}
