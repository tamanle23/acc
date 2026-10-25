import type {
  IPipelineClassifierStrategy,
  DiscoveredAssetManifest,
  ArchetypeScaffoldConfig,
} from '../types';

export class DbTemplatingClassifierStrategy implements IPipelineClassifierStrategy {
  public readonly pipelineId = '2';
  public readonly name = 'Database & Dynamic Templating Pipeline';
  public readonly description = 'Tabular datasets, leaderboards, bar chart races, and database-driven data cards.';

  public async calculateConfidence(manifest: DiscoveredAssetManifest): Promise<number> {
    const hasData = manifest.data.length > 0;
    const totalRows = manifest.data.reduce((acc, d) => acc + d.rowCount, 0);

    if (hasData) {
      const imageCount = manifest.visuals.filter((v) => v.type === 'image').length;
      if (imageCount >= 3 && manifest.pairedPairs.length >= 2) {
        return 0.4;
      }
      if (totalRows >= 5) return 0.95;
      if (totalRows >= 1) return 0.85;
      return 0.7;
    }

    return 0.02;
  }

  public generateArchetypeDefaults(manifest: DiscoveredAssetManifest): ArchetypeScaffoldConfig {
    const dataAsset = manifest.data[0];
    const defaultTitle = dataAsset?.fileName
      ? `Data Insights: ${dataAsset.fileName}`
      : 'Automated Data Visualizer';

    return {
      pipelineId: this.pipelineId,
      canonicalPipelineId: 'db-templating',
      suggestedTitle: manifest.suggestedTitle || defaultTitle,
      suggestedModalities: ['video', 'social', 'interactive-web'],
      defaultAspect: manifest.dominantVisualAspect || '9:16',
      defaultFps: 60, // 60 FPS for fluid chart race transitions
      chunkDurationMs: 20000,
      theme: 'neon_cyber_data',
      archetypeNotes: 'Configured for high-frequency data interpolation and animated charts.',
    };
  }
}
