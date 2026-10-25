import type {
  IPipelineClassifierStrategy,
  DiscoveredAssetManifest,
  ArchetypeScaffoldConfig,
} from '../types';

export class ScraperSummarizerClassifierStrategy implements IPipelineClassifierStrategy {
  public readonly pipelineId = '1';
  public readonly name = 'Scraper & Summarizer Pipeline';
  public readonly description = 'Articles, blog posts, news summaries, and text-heavy document digests.';

  public async calculateConfidence(manifest: DiscoveredAssetManifest): Promise<number> {
    const hasScripts = manifest.scripts.length > 0;
    const totalWordCount = manifest.scripts.reduce((acc, s) => acc + s.wordCount, 0);
    const hasVisuals = manifest.visuals.length > 0;
    const hasData = manifest.data.length > 0;

    // Heavily favors text-rich folders without pre-made sequential images or tabular data
    if (hasScripts && totalWordCount >= 50 && !hasData) {
      if (!hasVisuals) return 0.95;
      if (manifest.visuals.length <= 2) return 0.85;
      if (totalWordCount > 300) return 0.75;
      return 0.55;
    }

    if (hasScripts && totalWordCount > 20 && !hasVisuals && !hasData) {
      return 0.7;
    }

    return 0.05;
  }

  public generateArchetypeDefaults(manifest: DiscoveredAssetManifest): ArchetypeScaffoldConfig {
    return {
      pipelineId: this.pipelineId,
      canonicalPipelineId: 'scraper-summarizer',
      suggestedTitle: manifest.suggestedTitle || 'Article Digest & Summary',
      suggestedModalities: ['static-web', 'social', 'audio', 'video'],
      defaultAspect: manifest.dominantVisualAspect || '16:9',
      defaultFps: 30,
      chunkDurationMs: 12000,
      theme: 'clean_editorial',
      archetypeNotes: 'Configured for automated multi-source text extraction and bullet summaries.',
    };
  }
}
