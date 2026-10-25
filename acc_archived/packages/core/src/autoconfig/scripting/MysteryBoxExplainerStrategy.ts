import { BaseScriptingFrameworkStrategy } from './BaseScriptingFrameworkStrategy';
import type { ScriptBeat } from './IScriptingFrameworkStrategy';

/**
 * MysteryBoxExplainerStrategy
 *
 * Implements Framework 1: The "Mystery Box" Explainer.
 * Delays the core answer, constructs an A-Story / B-Story contrast with
 * heavy bass drops, synchronized drawing reveals, and whiteboard/void resets.
 *
 * Maps to: Immersive Documentary, Sketchbook, Isometric System Mapping,
 * Geopolitical Atlas, Visual Metaphor Engine, Tactile Flatlay, White Room Void.
 */
export class MysteryBoxExplainerStrategy extends BaseScriptingFrameworkStrategy {
  public readonly id = 'mystery-box-explainer';
  public readonly name = 'Mystery Box Explainer';
  public readonly description =
    'Delays the core answer, constructs an A-Story/B-Story contrast with heavy bass drops and whiteboard/void resets.';
  public readonly targetStyles = [
    'immersive-documentary',
    'sketchbook',
    'isometric-system',
    'geopolitical-atlas',
    'visual-metaphor-engine',
    'tactile-flatlay',
    'white-room-void',
  ];
  public override readonly aliases = ['mystery_box', 'mystery-box'];

  protected override duckingProfile = {
    attenuationDb: -16,
    attackMs: 150,
    releaseMs: 300,
  };

  protected override getNominalBeats(topic: string, rawContent?: string): ScriptBeat[] {
    return [
      {
        name: 'The Cold Hook',
        timingSec: [0, 5],
        audioRole: 'hook',
        visualPacing: 'rapid_cut',
        sfxCue: 'sfx_heavy_bass_drop',
        cameraPreset: 'rapid_parallax_zoom',
        typographyStyle: 'bold_climax',
        description: 'Show the climax or disaster immediately without explaining why yet.',
        narrationTemplate: `In an instant, everything changed because of one tiny detail everyone ignores about ${topic}.`,
      },
      {
        name: 'The Friction / Stakes',
        timingSec: [5, 15],
        audioRole: 'friction',
        visualPacing: 'rapid_cut',
        sfxCue: 'sfx_tension_riser',
        cameraPreset: 'dynamic_pan',
        typographyStyle: 'high_contrast',
        description: 'Visually connect the abstract concept to daily reality under high stakes.',
        narrationTemplate: `You interact with this every single day. And if it fails, it takes everything else down with it.`,
      },
      {
        name: 'The Title / Reset',
        timingSec: [15, 20],
        audioRole: 'turn',
        visualPacing: 'intimate_hold',
        sfxCue: 'sfx_whoosh_click',
        cameraPreset: 'static_center',
        typographyStyle: 'clean_title',
        description: 'Visual reset. Clear the screen or wipe whiteboard clean for a 2-second breath.',
        narrationTemplate: `To understand why, we have to look at how ${topic} actually works.`,
      },
      {
        name: 'The Metaphor Build',
        timingSec: [20, 90],
        audioRole: 'metaphor',
        visualPacing: 'kinetic_motion',
        sfxCue: 'sfx_metaphor_flow',
        cameraPreset: 'continuous_pan_zoom',
        typographyStyle: 'explanatory_callout',
        description: 'The core visual engine. Progressive drawing, isometric reveal or tactile stacking.',
        narrationTemplate:
          rawContent ||
          `Imagine ${topic} as an interconnected living system where every node must communicate with zero latency.`,
      },
      {
        name: 'The Turn / Complication',
        timingSec: [90, 120],
        audioRole: 'friction',
        visualPacing: 'rapid_cut',
        sfxCue: 'sfx_minor_key_tense',
        cameraPreset: 'dramatic_shake_cut',
        typographyStyle: 'warning_strobe',
        description: 'Introduce visual chaos: system turns red, anomaly breaks the flow.',
        narrationTemplate: `But there is a critical vulnerability. What happens when unexpected stress enters the architecture?`,
      },
      {
        name: 'The Climax & Payoff',
        timingSec: [120, 150],
        audioRole: 'climax',
        visualPacing: 'slow_burn',
        sfxCue: 'sfx_bass_impact_resolution',
        cameraPreset: 'hero_pullback',
        typographyStyle: 'thesis_reveal',
        description: 'Visual resolution: components snap cleanly into place revealing the thesis.',
        narrationTemplate: `This is where the true breakthrough of ${topic} changes everything.`,
      },
    ];
  }
}
