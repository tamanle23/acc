import { BaseScriptingFrameworkStrategy } from './BaseScriptingFrameworkStrategy';
import type { ScriptBeat } from './IScriptingFrameworkStrategy';

/**
 * BreadcrumbTrailDigitalStrategy
 *
 * Implements Framework 2: The "Breadcrumb Trail" Digital Framework.
 * Investigator thinking out loud; pacing driven by UI clicks, terminal code blocks,
 * window snap animations, and receipts on screen.
 *
 * Maps to: Screenlife Narrative, Terminal/Code Block, Evidence-Based Receipts,
 * Reverse Engineer Tear-Down, Internet Mystery.
 */
export class BreadcrumbTrailDigitalStrategy extends BaseScriptingFrameworkStrategy {
  public readonly id = 'breadcrumb-trail-digital';
  public readonly name = 'Breadcrumb Trail Digital';
  public readonly description =
    'Fast UI clicks, keyboard typing sounds, window snap animations, and high-retention terminal/document highlights.';
  public readonly targetStyles = [
    'screenlife-narrative',
    'terminal-code-block',
    'evidence-receipts',
    'reverse-engineer-teardown',
    'internet-mystery',
  ];
  public override readonly aliases = ['breadcrumb_trail', 'breadcrumb-trail'];

  protected override duckingProfile = {
    attenuationDb: -14,
    attackMs: 100,
    releaseMs: 250,
  };

  protected override getNominalBeats(topic: string, rawContent?: string): ScriptBeat[] {
    return [
      {
        name: 'The Discovery',
        timingSec: [0, 10],
        audioRole: 'hook',
        visualPacing: 'kinetic_motion',
        sfxCue: 'sfx_mouse_clicks_typing',
        cameraPreset: 'screen_focus',
        typographyStyle: 'terminal_cursor',
        description: 'Start already inside the screen. Anomaly circled or code typed rapidly.',
        narrationTemplate: `I was digging through the code for ${topic}, when I noticed an anomaly that made no sense.`,
      },
      {
        name: 'The Hypothesis',
        timingSec: [10, 30],
        audioRole: 'friction',
        visualPacing: 'rapid_cut',
        sfxCue: 'sfx_digital_highlight',
        cameraPreset: 'zoom_200_evidence',
        typographyStyle: 'receipts_highlight',
        description: 'Zoom in 200% on the evidence; highlight specific lines of code or data.',
        narrationTemplate: `If you look closely at this exact line, it shouldn't exist unless someone deliberately configured it.`,
      },
      {
        name: 'The Deep Dive',
        timingSec: [30, 105],
        audioRole: 'metaphor',
        visualPacing: 'kinetic_motion',
        sfxCue: 'sfx_window_snapping',
        cameraPreset: 'tab_switching_pan',
        typographyStyle: 'code_block_cascade',
        description: 'Screenlife choreography: snapping windows, navigating repos, running scripts.',
        narrationTemplate:
          rawContent ||
          `Let's trace this back through the commit history and inspect each subsystem powering ${topic}.`,
      },
      {
        name: 'The Dead End',
        timingSec: [105, 120],
        audioRole: 'turn',
        visualPacing: 'intimate_hold',
        sfxCue: 'sfx_error_chime_stop',
        cameraPreset: 'static_darkened',
        typographyStyle: 'error_log_glitch',
        description: 'The vacuum drop: music cuts to dead silence, an error log pops up.',
        narrationTemplate: `I thought I had solved it. But then this stack trace broke the hypothesis completely.`,
      },
      {
        name: 'The Final Decryption',
        timingSec: [120, 150],
        audioRole: 'climax',
        visualPacing: 'slow_burn',
        sfxCue: 'sfx_success_synth_chime',
        cameraPreset: 'wide_screen_clarity',
        typographyStyle: 'synthesized_takeaway',
        description: 'Digital clarity: tests pass, compilation succeeds, receipts align.',
        narrationTemplate: `It was never a bug. It was an intentional design pattern that defines ${topic}.`,
      },
    ];
  }
}
