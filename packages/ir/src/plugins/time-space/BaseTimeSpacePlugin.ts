import { TimeSpaceRegistry, TimeSpaceStateMachine } from '@acc/core-isomorphic';
import type {
  ModifierPlugin,
  ClipRenderContext,
  MasterCompositeContext,
  ModifierParameterSchema,
} from '../ModifierPluginRegistry';
import type { ModifierTargetScope } from '../../types/modifiers';
import type { SequenceType } from '../../types/VideoIR';

/**
 * BaseTimeSpacePlugin:
 * Abstract base class for discrete time_space/* procedural motion graphic plugins.
 * Encapsulates GSAP timeline state-machine lifecycle, cache invalidation, and isomorphic canvas rendering.
 */
export abstract class BaseTimeSpacePlugin<TParams extends Record<string, any> = Record<string, any>>
  implements ModifierPlugin<TParams> {
  public abstract readonly type: string;
  public abstract readonly templateId: string;
  public readonly targetScope: ModifierTargetScope = 'standalone';
  public readonly allowedSequenceTypes: readonly SequenceType[] = ['overlay', 'video', 'image'];
  public readonly targetPhase = 2;
  public abstract readonly schema: ModifierParameterSchema;

  private static machineCache = new WeakMap<object, { machine: TimeSpaceStateMachine; signature: string; templateId: string }>();
  private standaloneCache: { machine: TimeSpaceStateMachine; signature: string; templateId: string } | null = null;

  /**
   * Lazily instantiates or re-uses a cached TimeSpaceStateMachine on the target holder.
   * Invalidates and rebuilds when critical generative parameters change.
   */
  protected getOrCreateMachine(params: TParams, holder?: any): TimeSpaceStateMachine {
    const paramSignature = `${this.templateId}_${params.theme}_${params.primaryColor}_${params.accentColor}_${params.speedMultiplier}_${params.scale}_${params.density}_${params.strokeWidth}_${params.boundary}_${params.seed}_${params.renderMode}_${params.text}_${params.subtitle}_${params.targetX}_${params.targetY}_${params.labelX}_${params.labelY}`;

    if (holder && typeof holder === 'object') {
      const cached = BaseTimeSpacePlugin.machineCache.get(holder);
      if (cached && cached.signature === paramSignature && cached.templateId === this.templateId) {
        return cached.machine;
      }
      const machine = TimeSpaceRegistry.instantiate(this.templateId, params);
      BaseTimeSpacePlugin.machineCache.set(holder, {
        machine,
        signature: paramSignature,
        templateId: this.templateId,
      });
      // Preserve backward compatibility for callers inspecting legacy private fields
      try {
        holder._timeSpaceMachine = machine;
        holder._timeSpaceSignature = paramSignature;
        holder._timeSpaceTemplateId = this.templateId;
      } catch { }
      return machine;
    }

    if (this.standaloneCache && this.standaloneCache.signature === paramSignature && this.standaloneCache.templateId === this.templateId) {
      return this.standaloneCache.machine;
    }
    const machine = TimeSpaceRegistry.instantiate(this.templateId, params);
    this.standaloneCache = {
      machine,
      signature: paramSignature,
      templateId: this.templateId,
    };
    return machine;
  }

  public getActiveMachine(): TimeSpaceStateMachine | null {
    return this.standaloneCache?.machine ?? null;
  }

  /**
   * Evaluates procedural vector motion graphics in local clip space.
   */
  public renderClipSpace(ctx: ClipRenderContext | any, params: TParams, legacyCtx?: any): void {
    if (!params) return;

    const canvasCtx = ctx.ctx || ctx;
    const sequence = ctx.sequence || legacyCtx?.sequence;
    const localFrame = ctx.localFrame ?? legacyCtx?.clipFrame ?? legacyCtx?.localFrame ?? 0;
    const width = ctx.width ?? legacyCtx?.canvasWidth ?? legacyCtx?.width ?? 1920;
    const height = ctx.height ?? legacyCtx?.canvasHeight ?? legacyCtx?.height ?? 1080;
    const fps = sequence?.fps || legacyCtx?.fps || 30;

    const effectiveParams = {
      ...(params as any),
      ...(params.params || {}),
    };

    const machine = this.getOrCreateMachine(effectiveParams, sequence);
    this.standaloneCache = {
      machine,
      signature: `${this.templateId}_${effectiveParams.theme}`,
      templateId: this.templateId,
    };

    const viewport = { width, height };
    const snapshot = machine.seek(localFrame, fps, effectiveParams.seed ?? 1337, viewport);

    if (effectiveParams.renderMode !== 'webgl_buffers') {
      if (canvasCtx && typeof canvasCtx.save === 'function') {
        snapshot.render(canvasCtx);
      }
    }
  }

  /**
   * Backward-compatible alias for existing test calls or direct invocation.
   */
  public renderClip(ctx: ClipRenderContext, params: TParams): void {
    this.renderClipSpace(ctx, params);
  }

  /**
   * Evaluates procedural vector motion graphics in master composite timeline space.
   */
  public renderMasterComposite(ctx: MasterCompositeContext, params: TParams): void {
    if (!params) return;

    const effectiveParams = {
      ...(params as any),
      ...(params.params || {}),
    };

    const machine = this.getOrCreateMachine(effectiveParams, ctx);
    const fps = 30;
    const viewport = { width: ctx.width, height: ctx.height };

    const snapshot = machine.seek(ctx.frame, fps, effectiveParams.seed ?? 1337, viewport);

    if (effectiveParams.renderMode !== 'webgl_buffers') {
      if (ctx.ctx && typeof ctx.ctx.save === 'function') {
        snapshot.render(ctx.ctx);
      }
    }
  }
}
