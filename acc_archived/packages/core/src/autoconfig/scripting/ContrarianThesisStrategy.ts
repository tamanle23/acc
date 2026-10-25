import { BaseScriptingFrameworkStrategy } from './BaseScriptingFrameworkStrategy';
import type { ScriptBeat } from './IScriptingFrameworkStrategy';

/**
 * ContrarianThesisStrategy
 *
 * Implements Framework 6: The "Contrarian Thesis & Proof" Framework.
 * Opens with a provocative, myth-shattering claim, follows with indisputable
 * evidence receipts and forensic teardown, concluding with a paradigm shift.
 *
 * Maps to: Video Essay, Synthetic Broadcast, Culinary Metaphor,
 * Contrarian Thesis, Data Drama.
 */
export class ContrarianThesisStrategy extends BaseScriptingFrameworkStrategy {
  public readonly id = 'contrarian-thesis';
  public readonly name = 'Contrarian Thesis & Proof';
  public readonly description =
    'Provocative opening thesis, myth busting badges, evidence receipts, and punchy resolution beats.';
  public readonly targetStyles = [
    'video-essay',
    'synthetic-broadcast',
    'culinary-metaphor',
    'contrarian-thesis',
    'data-drama',
  ];
  public override readonly aliases = [
    'contrarian_thesis',
    'thesis-and-proof',
    'thesis_and_proof',
  ];

  protected override duckingProfile = {
    attenuationDb: -16,
    attackMs: 120,
    releaseMs: 280,
  };

  protected override getNominalBeats(topic: string, rawContent?: string): ScriptBeat[] {
    return [
      {
        name: 'The Provocative Thesis',
        timingSec: [0, 15],
        audioRole: 'hook',
        visualPacing: 'rapid_cut',
        sfxCue: 'sfx_gavel_strike_record_stop',
        cameraPreset: 'dramatic_crash_zoom',
        typographyStyle: 'myth_busting_badge',
        description: 'Crash zoom with bold statement shattering industry consensus.',
        narrationTemplate: `Everyone believes that ${topic} is an unquestionable triumph. They are completely mistaken.`,
      },
      {
        name: 'The Consensus Lie',
        timingSec: [15, 45],
        audioRole: 'friction',
        visualPacing: 'kinetic_motion',
        sfxCue: 'sfx_interrogation_hum',
        cameraPreset: 'interrogation_lighting_pan',
        typographyStyle: 'popular_belief_quote',
        description: 'Forensic inspection of widespread popular myths with stark lighting.',
        narrationTemplate: `The prevailing consensus has been echoed so continuously that nobody questioned the underlying metrics.`,
      },
      {
        name: 'The Counter-Evidence (Receipts)',
        timingSec: [45, 105],
        audioRole: 'metaphor',
        visualPacing: 'kinetic_motion',
        sfxCue: 'sfx_stamp_slam_paper_slides',
        cameraPreset: 'macro_receipts_stack',
        typographyStyle: 'evidence_data_badge',
        description: 'Hard data receipts, benchmark graphs, and undeniable audit records.',
        narrationTemplate:
          rawContent ||
          `Here are the actual receipts: independent audits and real-world benchmarks reveal the true cost of ${topic}.`,
      },
      {
        name: 'The Cost of the Illusion',
        timingSec: [105, 150],
        audioRole: 'turn',
        visualPacing: 'slow_burn',
        sfxCue: 'sfx_somber_cello_drone',
        cameraPreset: 'slow_pull_back_cold',
        typographyStyle: 'consequence_callout',
        description: 'Camera pulls back slowly to expose the systemic cost of continuing the illusion.',
        narrationTemplate: `Failing to acknowledge this reality results in compounding inefficiencies and wasted effort.`,
      },
      {
        name: 'The Paradigm Shift',
        timingSec: [150, 180],
        audioRole: 'climax',
        visualPacing: 'kinetic_motion',
        sfxCue: 'sfx_energizing_brass_impact',
        cameraPreset: 'forward_momentum_glide',
        typographyStyle: 'new_rule_thesis',
        description: 'Triumphant brass impact and forward momentum as the new paradigm is revealed.',
        narrationTemplate: `The future does not belong to outdated conventions; it belongs to the pioneers who embrace this new architecture.`,
      },
    ];
  }
}
