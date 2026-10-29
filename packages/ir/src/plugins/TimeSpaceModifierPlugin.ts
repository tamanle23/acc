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
          { label: 'HUD Tactical Reticle', value: 'hud_tactical_reticle' },
          { label: 'Multi-Target Leader Callout', value: 'callout_multitarget' },
          { label: 'Proximity Network Plexus', value: 'network_plexus' },
          { label: 'Radial Audio Waveform Ring', value: 'audio_waveform_ring' },
          { label: 'Cyber Tech Lower-Third', value: 'cyber_lower_third' },
          { label: 'Cinematic Countdown Timer', value: 'dynamic_countdown' },
          { label: 'Energy Shield Hex Lattice', value: 'energy_shield_hex' },
          { label: 'Glitch Data Stream Matrix', value: 'glitch_data_stream' },
          { label: 'Parametric Superformula Geometry', value: 'parametric_superformula' },
          { label: 'Dynamic Audio Equalizer Spectrum', value: 'audio_equalizer_spectrum' },
        ],
      },
      theme: {
        key: 'theme',
        label: 'Aesthetic Theme',
        type: 'select' as const,
        defaultValue: 'cyberpunk',
        options: [
          { label: 'Cyberpunk Neon', value: 'cyberpunk' },
          { label: 'Solar Flare Warmth', value: 'solar_flare' },
          { label: 'Emerald Matrix', value: 'emerald_matrix' },
          { label: 'Monochrome Titanium', value: 'monochrome_titanium' },
          { label: 'Synthwave Neon', value: 'synthwave_neon' },
          { label: 'Tactical Amber', value: 'tactical_amber' },
        ],
      },
      primaryColor: {
        key: 'primaryColor',
        label: 'Primary Accent Color',
        type: 'string' as const,
        defaultValue: '',
      },
      accentColor: {
        key: 'accentColor',
        label: 'Secondary / Highlight Color',
        type: 'string' as const,
        defaultValue: '',
      },
      speedMultiplier: {
        key: 'speedMultiplier',
        label: 'Motion Speed Multiplier',
        type: 'number' as const,
        min: 0.1,
        max: 5.0,
        step: 0.1,
        defaultValue: 1.0,
      },
      scale: {
        key: 'scale',
        label: 'Geometric Scale',
        type: 'number' as const,
        min: 0.2,
        max: 3.0,
        step: 0.1,
        defaultValue: 1.0,
      },
      density: {
        key: 'density',
        label: 'Lattice / Particle Density',
        type: 'number' as const,
        min: 8,
        max: 128,
        step: 4,
        defaultValue: 32,
      },
      strokeWidth: {
        key: 'strokeWidth',
        label: 'Vector Stroke Width',
        type: 'number' as const,
        min: 0.5,
        max: 8.0,
        step: 0.5,
        defaultValue: 1.5,
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
      // Re-create machine if templateId or critical parametric keys change
      const paramSignature = `${templateId}_${customParams?.theme}_${customParams?.primaryColor}_${customParams?.speedMultiplier}_${customParams?.scale}_${customParams?.density}_${customParams?.strokeWidth}`;
      if (!targetHolder._timeSpaceMachine || targetHolder._timeSpaceSignature !== paramSignature) {
        targetHolder._timeSpaceMachine = TimeSpaceRegistry.instantiate(templateId, customParams);
        targetHolder._timeSpaceSignature = paramSignature;
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
