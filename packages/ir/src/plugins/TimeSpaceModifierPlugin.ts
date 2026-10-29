import { TimeSpaceRegistry, TimeSpaceStateMachine } from '@acc/core-isomorphic';
import type { TimeSpaceModifierParams } from '../types/modifiers';
import type {
  ModifierPlugin,
  ClipRenderContext,
  MasterCompositeContext,
} from './ModifierPluginRegistry';

/**
 * TimeSpaceModifierPlugin:
 * Connects the isomorphic Time-Space State Machine into the VideoIR rendering pipeline.
 * Evaluates procedural motion graphics, callouts, and particle fields deterministically.
 */
export class TimeSpaceModifierPlugin implements ModifierPlugin<TimeSpaceModifierParams> {
  public readonly type = 'time_space';
  public readonly targetScope = 'both';
  public readonly targetPhase = 2;
  public readonly schema = {
    fields: {
      templateId: {
        key: 'templateId',
        label: 'Motion Template ID',
        type: 'string' as const,
        defaultValue: 'callout_pulse',
      },
      boundary: {
        key: 'boundary',
        label: 'Temporal Boundary Mode',
        type: 'select' as const,
        defaultValue: 'loop',
        options: [
          { label: 'Loop Continuously', value: 'loop' },
          { label: 'Ping-Pong Oscillate', value: 'pingpong' },
          { label: 'Clamp Terminal Frame', value: 'clamp' },
          { label: 'Play Once', value: 'once' },
        ],
      },
    },
  };

  public getOrCreateMachine(templateId: string, customParams?: any, targetHolder?: any): TimeSpaceStateMachine {
    if (targetHolder) {
      if (!targetHolder._timeSpaceMachine || targetHolder._timeSpaceTemplateId !== templateId) {
        targetHolder._timeSpaceMachine = TimeSpaceRegistry.instantiate(templateId, customParams);
        targetHolder._timeSpaceTemplateId = templateId;
      }
      return targetHolder._timeSpaceMachine;
    }
    return TimeSpaceRegistry.instantiate(templateId, customParams);
  }

  public renderClipSpace(ctx: ClipRenderContext, params: TimeSpaceModifierParams): void {
    if (!params || !params.templateId) return;

    const machine = this.getOrCreateMachine(params.templateId, params.params, ctx.sequence);
    const fps = (ctx.sequence as any)?.fps || 30;
    const viewport = { width: ctx.width, height: ctx.height };

    const snapshot = machine.seek(ctx.localFrame, fps, params.seed ?? 1337, viewport);

    if (params.renderMode !== 'webgl_buffers') {
      snapshot.render(ctx.ctx);
    }
  }

  /**
   * Backward-compatible alias for existing test calls or direct invocation.
   */
  public renderClip(ctx: ClipRenderContext, params: TimeSpaceModifierParams): void {
    this.renderClipSpace(ctx, params);
  }

  public renderMasterComposite(ctx: MasterCompositeContext, params: TimeSpaceModifierParams): void {
    if (!params || !params.templateId) return;

    const machine = this.getOrCreateMachine(params.templateId, params.params, ctx);
    const fps = 30;
    const viewport = { width: ctx.width, height: ctx.height };

    const snapshot = machine.seek(ctx.frame, fps, params.seed ?? 1337, viewport);

    if (params.renderMode !== 'webgl_buffers') {
      snapshot.render(ctx.ctx);
    }
  }
}
