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

  private machineCache: Map<string, TimeSpaceStateMachine> = new Map();

  public getOrCreateMachine(templateId: string, customParams?: any, cacheKey?: string): TimeSpaceStateMachine {
    const key = cacheKey || templateId;
    let machine = this.machineCache.get(key);
    if (!machine) {
      machine = TimeSpaceRegistry.instantiate(templateId, customParams);
      this.machineCache.set(key, machine);
    }
    return machine;
  }

  public renderClip(ctx: ClipRenderContext, params: TimeSpaceModifierParams): void {
    if (!params || !params.templateId) return;

    const cacheKey = `${ctx.sequence.id}_${params.templateId}`;
    const machine = this.getOrCreateMachine(params.templateId, params.params, cacheKey);
    const fps = 30; // Standard baseline frame rate
    const viewport = { width: ctx.width, height: ctx.height };

    const snapshot = machine.seek(ctx.localFrame, fps, params.seed ?? 1337, viewport);

    if (params.renderMode !== 'webgl_buffers') {
      snapshot.render(ctx.ctx);
    }
  }

  public renderMasterComposite(ctx: MasterCompositeContext, params: TimeSpaceModifierParams): void {
    if (!params || !params.templateId) return;

    const cacheKey = `master_${params.templateId}`;
    const machine = this.getOrCreateMachine(params.templateId, params.params, cacheKey);
    const fps = 30;
    const viewport = { width: ctx.width, height: ctx.height };

    const snapshot = machine.seek(ctx.frame, fps, params.seed ?? 1337, viewport);

    if (params.renderMode !== 'webgl_buffers') {
      snapshot.render(ctx.ctx);
    }
  }
}
