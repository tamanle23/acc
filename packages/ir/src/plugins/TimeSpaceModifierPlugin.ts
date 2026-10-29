import { TimeSpaceRegistry, TimeSpaceStateMachine } from '@acc/core-isomorphic';
import type { TimeSpaceModifierParams } from '../types/modifiers';
import type { ModifierParameterSchema } from './ModifierPluginRegistry';
import { BaseTimeSpacePlugin } from './time-space/BaseTimeSpacePlugin';

/**
 * TimeSpaceModifierPlugin (Legacy Adapter):
 * Preserves 100% backwards compatibility for legacy VideoIR documents and tests
 * referencing the monolithic 'time_space' type.
 * Discrete implementations are now available under 'time_space/*'.
 */
export class TimeSpaceModifierPlugin extends BaseTimeSpacePlugin<TimeSpaceModifierParams> {
  public readonly type = 'time_space';
  public readonly templateId = 'callout_leader';

  public readonly schema: ModifierParameterSchema = {
    displayName: 'Legacy Time-Space Procedural Motion Graphic',
    category: 'motion',
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
    },
  };

  /**
   * Overridden machine resolution supporting dynamic templateId dispatching.
   */
  public override getOrCreateMachine(params: TimeSpaceModifierParams, holder?: any): TimeSpaceStateMachine {
    const templateId = params?.templateId || this.templateId;
    if (holder) {
      const paramSignature = `${templateId}_${params?.theme}_${params?.primaryColor}_${params?.accentColor}_${params?.speedMultiplier}_${params?.scale}_${params?.density}_${params?.strokeWidth}_${params?.boundary}_${params?.text}_${params?.subtitle}_${params?.targetX}_${params?.targetY}_${params?.labelX}_${params?.labelY}`;
      if (!holder._timeSpaceMachine || holder._timeSpaceSignature !== paramSignature || holder._timeSpaceTemplateId !== templateId) {
        holder._timeSpaceMachine = TimeSpaceRegistry.instantiate(templateId, params);
        holder._timeSpaceSignature = paramSignature;
        holder._timeSpaceTemplateId = templateId;
      }
      return holder._timeSpaceMachine;
    }
    return TimeSpaceRegistry.instantiate(templateId, params);
  }
}
