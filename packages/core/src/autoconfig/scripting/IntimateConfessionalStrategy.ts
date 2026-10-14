import { BaseScriptingFrameworkStrategy } from './BaseScriptingFrameworkStrategy';
import type { ScriptBeat } from './IScriptingFrameworkStrategy';

/**
 * IntimateConfessionalStrategy
 *
 * Implements Framework 4: The "Intimate Confessional" Framework.
 * Relies on unvarnished vulnerability, conversational cadence, unbroken takes,
 * gentle background bokeh, and empathetic audio ducking.
 *
 * Maps to: Parasocial Anchor, Walking Monologue, Intimate Confessional,
 * Director's Commentary.
 */
export class IntimateConfessionalStrategy extends BaseScriptingFrameworkStrategy {
  public readonly id = 'intimate-confessional';
  public readonly name = 'Intimate Confessional';
  public readonly description =
    'Long takes, conversational pauses, gentle background bokeh, and emotional audio ducking.';
  public readonly targetStyles = [
    'parasocial-anchor',
    'walking-monologue',
    'intimate-confessional',
    'directors-commentary',
  ];
  public override readonly aliases = ['intimate_confessional', 'parasocial-confessional'];

  protected override duckingProfile = {
    attenuationDb: -22,
    attackMs: 300,
    releaseMs: 500,
  };

  protected override getNominalBeats(topic: string, rawContent?: string): ScriptBeat[] {
    return [
      {
        name: 'The Raw Open',
        timingSec: [0, 10],
        audioRole: 'hook',
        visualPacing: 'intimate_hold',
        sfxCue: 'sfx_room_tone_breath',
        cameraPreset: 'medium_close_bokeh',
        typographyStyle: 'minimal_subtle_caption',
        description: 'Subject starts mid-thought, settling into frame with practical warm lighting.',
        narrationTemplate: `I need to be completely honest with you about what really happened with ${topic}.`,
      },
      {
        name: 'Behind the Curtain',
        timingSec: [10, 45],
        audioRole: 'friction',
        visualPacing: 'slow_burn',
        sfxCue: 'sfx_melancholic_piano',
        cameraPreset: 'natural_handheld_drift',
        typographyStyle: 'quiet_editorial',
        description: 'Contrasts external perceived success with internal friction; unbroken intimate take.',
        narrationTemplate: `From the outside, everything looked flawless. But behind the scenes, we were barely holding it together.`,
      },
      {
        name: 'The Vulnerable Pivot',
        timingSec: [45, 90],
        audioRole: 'turn',
        visualPacing: 'slow_burn',
        sfxCue: 'sfx_soft_ambient_pad',
        cameraPreset: 'slow_push_in',
        typographyStyle: 'monologue_reflection',
        description: 'Slow push-in zoom during emotional confession; quiet breathing space.',
        narrationTemplate:
          rawContent ||
          `I realized that the way we were pursuing ${topic} was completely unsustainable.`,
      },
      {
        name: 'The Shared Lesson',
        timingSec: [90, 135],
        audioRole: 'metaphor',
        visualPacing: 'intimate_hold',
        sfxCue: 'sfx_warm_acoustic_swell',
        cameraPreset: 'direct_eye_level',
        typographyStyle: 'empathetic_callout',
        description: 'Transition from personal confession to direct viewer empathy and insight.',
        narrationTemplate: `If you are grappling with this right now, know that you are not alone. Here is the mindset shift that saved us.`,
      },
      {
        name: 'The Grounded Outro',
        timingSec: [135, 150],
        audioRole: 'resolution',
        visualPacing: 'intimate_hold',
        sfxCue: 'sfx_camera_click_shut',
        cameraPreset: 'walk_away_hold',
        typographyStyle: 'signoff_minimal',
        description: 'Casual, grounded sign-off. Subject turns off camera; zero promotional CTA.',
        narrationTemplate: `Anyway, thank you for listening. Let's get back to building.`,
      },
    ];
  }
}
