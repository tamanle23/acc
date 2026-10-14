import { BaseScriptingFrameworkStrategy } from './BaseScriptingFrameworkStrategy';
import type { ScriptBeat } from './IScriptingFrameworkStrategy';

/**
 * HistoricalParallelsStrategy
 *
 * Implements Framework 5: The "Historical Parallels" Framework.
 * Employs dual-timeline split screens, archival parchment LUT grading,
 * rhythmic historical comparisons, and chronological convergence.
 *
 * Maps to: Archival Collage, Scrapbook Style, Historical Parallels,
 * Kinetic Typography, Dual-Stimulus, Infinite Fractal.
 */
export class HistoricalParallelsStrategy extends BaseScriptingFrameworkStrategy {
  public readonly id = 'historical-parallels';
  public readonly name = 'Historical Parallels';
  public readonly description =
    'Dual-timeline split screens, archival parchment LUT grading, and chronological progress pacing.';
  public readonly targetStyles = [
    'archival-collage',
    'scrapbook-style',
    'historical-parallels',
    'kinetic-typography',
    'dual-stimulus',
    'infinite-fractal',
  ];
  public override readonly aliases = [
    'historical_parallels',
    'rhythm-and-flow',
    'rhythm_and_flow',
  ];

  protected override duckingProfile = {
    attenuationDb: -15,
    attackMs: 250,
    releaseMs: 400,
  };

  protected override getNominalBeats(topic: string, rawContent?: string): ScriptBeat[] {
    return [
      {
        name: 'The Echo Hook',
        timingSec: [0, 15],
        audioRole: 'hook',
        visualPacing: 'slow_burn',
        sfxCue: 'sfx_parchment_gramophone',
        cameraPreset: 'dual_timeline_split',
        typographyStyle: 'archival_date_stamp',
        description: 'Dual-timeline visual juxtaposition establishing the historical parallel.',
        narrationTemplate: `A century ago, pioneers faced the exact same dilemma that currently defines ${topic}.`,
      },
      {
        name: 'The Forgotten Precedent',
        timingSec: [15, 60],
        audioRole: 'metaphor',
        visualPacing: 'slow_burn',
        sfxCue: 'sfx_clock_ticking_strings',
        cameraPreset: 'pan_vintage_map',
        typographyStyle: 'parchment_serif',
        description: 'Vintage maps and archival parchment reveal the initial warning signs.',
        narrationTemplate:
          rawContent ||
          `Records from that era demonstrate that every modern complication was predicted in detail.`,
      },
      {
        name: 'The Modern Mirror',
        timingSec: [60, 105],
        audioRole: 'turn',
        visualPacing: 'rapid_cut',
        sfxCue: 'sfx_digital_glitch_strings',
        cameraPreset: 'modern_reframe_whip',
        typographyStyle: 'modern_contrast_sans',
        description: 'Whip-pan transition into high-tech modern footage showing identical patterns.',
        narrationTemplate: `Fast forward to the modern landscape: the exact same dynamic is playing out under new branding.`,
      },
      {
        name: 'The Inevitable Crisis',
        timingSec: [105, 150],
        audioRole: 'friction',
        visualPacing: 'kinetic_motion',
        sfxCue: 'sfx_timpani_percussion_build',
        cameraPreset: 'converging_split_screen',
        typographyStyle: 'bold_parallel_comparison',
        description: 'Both historical and modern timelines play synchronously as the crisis crests.',
        narrationTemplate: `When past decisions are mirrored without adaptation, the systemic breaking point is reached.`,
      },
      {
        name: 'The Historical Verdict',
        timingSec: [150, 180],
        audioRole: 'climax',
        visualPacing: 'slow_burn',
        sfxCue: 'sfx_orchestral_crescendo',
        cameraPreset: 'expansive_timelapse',
        typographyStyle: 'timeless_lesson',
        description: 'Expansive drone or timelapse shot delivering the philosophical synthesis.',
        narrationTemplate: `History does not repeat, but when it comes to ${topic}, it rhymes with chilling precision.`,
      },
    ];
  }
}
