import { TimeSpaceRegistry, TimeSpaceStateMachine } from '@acc/core-isomorphic';
import type {
  ModifierPlugin,
  ClipRenderContext,
  MasterCompositeContext,
  ModifierParameterSchema,
} from '../ModifierPluginRegistry';

/**
 * BaseTimeSpacePlugin:
 * Abstract base class for discrete time_space/* procedural motion graphic plugins.
 * Encapsulates GSAP timeline state-machine lifecycle, cache invalidation, and isomorphic canvas rendering.
 */
export abstract class BaseTimeSpacePlugin<TParams extends Record<string, any> = Record<string, any>>
  implements ModifierPlugin<TParams> {
  public abstract readonly type: string;
  public abstract readonly templateId: string;
  public readonly targetScope = 'both';
  public readonly targetPhase = 2;
  public abstract readonly schema: ModifierParameterSchema;

  /**
   * Lazily instantiates or re-uses a cached TimeSpaceStateMachine on the target holder.
   * Invalidates and rebuilds when critical generative parameters change.
   */
  protected getOrCreateMachine(params: TParams, holder?: any): TimeSpaceStateMachine {
    if (holder) {
      const paramSignature = `${this.templateId}_${params.theme}_${params.primaryColor}_${params.accentColor}_${params.speedMultiplier}_${params.scale}_${params.density}_${params.strokeWidth}_${params.boundary}_${params.text}_${params.subtitle}_${params.targetX}_${params.targetY}_${params.labelX}_${params.labelY}`;
      if (!holder._timeSpaceMachine || holder._timeSpaceSignature !== paramSignature || holder._timeSpaceTemplateId !== this.templateId) {
        holder._timeSpaceMachine = TimeSpaceRegistry.instantiate(this.templateId, params);
        holder._timeSpaceSignature = paramSignature;
        holder._timeSpaceTemplateId = this.templateId;
      }
      return holder._timeSpaceMachine;
    }
    return TimeSpaceRegistry.instantiate(this.templateId, params);
  }

  /**
   * Evaluates procedural vector motion graphics in local clip space.
   */
  public renderClipSpace(ctx: ClipRenderContext, params: TParams): void {
    if (!params) return;

    const effectiveParams = {
      ...(params as any),
      ...(params.params || {}),
    };

    const machine = this.getOrCreateMachine(effectiveParams, ctx.sequence);
    const fps = (ctx.sequence as any)?.fps || 30;
    const viewport = { width: ctx.width, height: ctx.height };

    const snapshot = machine.seek(ctx.localFrame, fps, effectiveParams.seed ?? 1337, viewport);

    if (effectiveParams.renderMode !== 'webgl_buffers') {
      snapshot.render(ctx.ctx);
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
      snapshot.render(ctx.ctx);
    }
  }
}
