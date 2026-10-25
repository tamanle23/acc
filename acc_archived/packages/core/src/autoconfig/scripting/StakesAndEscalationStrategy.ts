import { BaseScriptingFrameworkStrategy } from './BaseScriptingFrameworkStrategy';
import type { ScriptBeat } from './IScriptingFrameworkStrategy';

/**
 * StakesAndEscalationStrategy
 *
 * Implements Framework 3: The "Stakes & Escalation" Challenge Framework.
 * Focuses on high-stakes constraints, strict rules, physical actions, and
 * relentless countdowns to manufacture adrenaline.
 *
 * Maps to: Hyper-Retention Challenge, Speedrun, Bodycam FPS, Top-Down Gameplay,
 * Day in the Life POV.
 */
export class StakesAndEscalationStrategy extends BaseScriptingFrameworkStrategy {
  public readonly id = 'stakes-and-escalation';
  public readonly name = 'Stakes & Escalation Challenge';
  public readonly description =
    'Countdown timers, progress bars, rule kinetic typography, and high-contrast tension drops.';
  public readonly targetStyles = [
    'hyper-retention-challenge',
    'speedrun',
    'bodycam-fps',
    'top-down-gameplay',
    'day-in-the-life-pov',
  ];
  public override readonly aliases = ['stakes_and_escalation', 'stakes-escalation'];

  protected override duckingProfile = {
    attenuationDb: -18,
    attackMs: 80,
    releaseMs: 200,
  };

  protected override getNominalBeats(topic: string, rawContent?: string): ScriptBeat[] {
    return [
      {
        name: 'The Ultimatum Hook',
        timingSec: [0, 5],
        audioRole: 'hook',
        visualPacing: 'rapid_cut',
        sfxCue: 'sfx_airhorn_timer_tick',
        cameraPreset: 'high_energy_snap',
        typographyStyle: 'massive_timer_countdown',
        description: 'High-energy establishing shot with bold countdown timer and explicit stakes.',
        narrationTemplate: `I have exactly 24 hours to conquer ${topic}, or the entire operation shuts down.`,
      },
      {
        name: 'The Rule Set',
        timingSec: [5, 15],
        audioRole: 'friction',
        visualPacing: 'kinetic_motion',
        sfxCue: 'sfx_whoosh_stamp',
        cameraPreset: 'snap_cut_constraints',
        typographyStyle: 'kinetic_rule_cards',
        description: 'Fast montage with kinetic typography slamming onto the screen for each rule.',
        narrationTemplate: `Rule 1: No external assistance. Rule 2: Zero budget. Rule 3: Flawless execution.`,
      },
      {
        name: 'Phase 1: Easy Wins',
        timingSec: [15, 60],
        audioRole: 'metaphor',
        visualPacing: 'kinetic_motion',
        sfxCue: 'sfx_arcade_level_up',
        cameraPreset: 'fast_montage',
        typographyStyle: 'progress_bar_fill',
        description: 'Upbeat pacing, progress bar fills rapidly, creating a false sense of security.',
        narrationTemplate:
          rawContent ||
          `The first phase went smoothly. We deployed the initial architecture for ${topic} without friction.`,
      },
      {
        name: 'Phase 2: The Wall',
        timingSec: [60, 120],
        audioRole: 'turn',
        visualPacing: 'rapid_cut',
        sfxCue: 'sfx_record_scratch_drone',
        cameraPreset: 'shaky_handheld',
        typographyStyle: 'alert_red_glitch',
        description: 'Unforeseen disaster halts momentum; camera shakes and tension spikes.',
        narrationTemplate: `Then at hour 14, everything completely fell apart. Critical systems seized up.`,
      },
      {
        name: 'The Pivot',
        timingSec: [120, 165],
        audioRole: 'friction',
        visualPacing: 'kinetic_motion',
        sfxCue: 'sfx_gear_shift_riser',
        cameraPreset: 'action_tracking',
        typographyStyle: 'strategy_override',
        description: 'Frantic strategy change: new mechanic or mental shift executed rapidly.',
        narrationTemplate: `With time running out, we discarded the textbook approach and pivoted entirely.`,
      },
      {
        name: 'The Buzzer Beater',
        timingSec: [165, 180],
        audioRole: 'climax',
        visualPacing: 'slow_burn',
        sfxCue: 'sfx_buzzer_euphoric_drop',
        cameraPreset: 'dramatic_slowmo',
        typographyStyle: 'victory_hero_title',
        description: 'Climax: fast cuts between timer and goal, culminating in a euphoric drop.',
        narrationTemplate: `With only seconds left on the clock... against all odds, we made it work.`,
      },
    ];
  }
}
