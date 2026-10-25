import type {
  IPipelineClassifierStrategy,
  DiscoveredAssetManifest,
  ArchetypeScaffoldConfig,
} from '../types';

export class RuleLogicClassifierStrategy implements IPipelineClassifierStrategy {
  public readonly pipelineId = '5';
  public readonly name = 'Rule-Logic & Procedural Engine Pipeline';
  public readonly description = 'Conditional branching scenarios, interactive widgets, quiz logic, and rule trees.';

  public async calculateConfidence(manifest: DiscoveredAssetManifest): Promise<number> {
    const hasBranchingKeywords = manifest.scripts.some((s) =>
      /(choice|branch|decision|option\s*\d+|quiz|if\s*\(|condition|theorem|proof|q\.e\.d|qed|problemstatement)/i.test(
        s.content
      )
    );

    const hasRuleData = manifest.data.some((d) => {
      const sampleStr = JSON.stringify(d.sampleData || '');
      return /(rules|conditions|nextStep|targetNode|branches|choices|steps|proof)/i.test(sampleStr);
    });

    if (hasRuleData) return 0.98;
    if (hasBranchingKeywords) return 0.92;

    return 0.05;
  }

  public generateArchetypeDefaults(manifest: DiscoveredAssetManifest): ArchetypeScaffoldConfig {
    return {
      pipelineId: this.pipelineId,
      canonicalPipelineId: 'rule-logic',
      suggestedTitle: manifest.suggestedTitle || 'Interactive Decision Tree',
      suggestedModalities: ['interactive-web', 'static-web'],
      defaultAspect: '16:9',
      defaultFps: 30,
      chunkDurationMs: 10000,
      theme: 'interactive_clean',
      archetypeNotes: 'Configured for procedural state transitions, user choice branches, and conditional nodes.',
    };
  }
}
