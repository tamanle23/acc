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
        label: 'Motion Template',
        type: 'select' as const,
        defaultValue: 'callout_leader',
        options: [
          { label: 'Tracking Callout Leader', value: 'callout_leader' },
          { label: 'Kinetic Pop-In Title', value: 'kinetic_title' },
          { label: 'Ambient Particle Field', value: 'particle_ambient' },
        ],
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
      text: {
        key: 'text',
        label: 'Callout / Title Text',
        type: 'string' as const,
        defaultValue: 'TARGET ACQUIRED',
      },
      targetX: {
        key: 'targetX',
        label: 'Target X Position',
        type: 'number' as const,
        min: -1.0,
        max: 1.0,
        step: 0.05,
        defaultValue: 0.0,
      },
      targetY: {
        key: 'targetY',
        label: 'Target Y Position',
        type: 'number' as const,
        min: -1.0,
        max: 1.0,
        step: 0.05,
        defaultValue: 0.0,
      },
      labelX: {
        key: 'labelX',
        label: 'Label X Offset',
        type: 'number' as const,
        min: -1.0,
        max: 1.0,
        step: 0.05,
        defaultValue: 0.35,
      },
      labelY: {
        key: 'labelY',
        label: 'Label Y Offset',
        type: 'number' as const,
        min: -1.0,
        max: 1.0,
        step: 0.05,
        defaultValue: -0.25,
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

    // Merge flat descriptor params (text, targetX, etc.) with any nested params object for maximum ergonomics
    const effectiveParams = {
      ...(params as any),
      ...(params.params || {}),
    };

    const machine = this.getOrCreateMachine(params.templateId, effectiveParams, ctx.sequence);
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

    const effectiveParams = {
      ...(params as any),
      ...(params.params || {}),
    };

    const machine = this.getOrCreateMachine(params.templateId, effectiveParams, ctx);
    const fps = 30;
    const viewport = { width: ctx.width, height: ctx.height };

    const snapshot = machine.seek(ctx.frame, fps, params.seed ?? 1337, viewport);

    if (params.renderMode !== 'webgl_buffers') {
      snapshot.render(ctx.ctx);
    }
  }
}
