import type {
  IPipelineClassifierStrategy,
  DiscoveredAssetManifest,
  ArchetypeScaffoldConfig,
} from '../types';

export class AmbientLoopClassifierStrategy implements IPipelineClassifierStrategy {
  public readonly pipelineId = '6';
  public readonly name = 'Ambient Loops & Soundscapes Pipeline';
  public readonly description = 'Seamless looping audio, lo-fi beats, relaxation soundscapes, and atmospheric backgrounds.';

  public calculateConfidence(manifest: DiscoveredAssetManifest): number {
    const ambientOrMusic = manifest.audio.filter(
      (a) => a.classification === 'ambient' || a.classification === 'music'
    );
    const voiceovers = manifest.audio.filter((a) => a.classification === 'voiceover');

    const hasLoopKeywords = manifest.audio.some((a) =>
      /(loop|lofi|relax|sleep|meditation|ambient|rain_sound|drone)/i.test(a.fileName)
    );

    if (ambientOrMusic.length > 0 && voiceovers.length === 0 && manifest.scripts.length === 0) {
      if (hasLoopKeywords) return 0.96;
      if (manifest.visuals.length <= 2) return 0.92;
      return 0.75;
    }

    if (hasLoopKeywords && voiceovers.length === 0) {
      return 0.85;
    }

    return 0.05;
  }

  public generateArchetypeDefaults(manifest: DiscoveredAssetManifest): ArchetypeScaffoldConfig {
    return {
      pipelineId: this.pipelineId,
      canonicalPipelineId: 'ambient-loops',
      suggestedTitle: manifest.suggestedTitle || 'Ambient Soundscape Experience',
      suggestedModalities: ['video', 'audio'],
      defaultAspect: manifest.dominantVisualAspect || '16:9',
      defaultFps: 30,
      chunkDurationMs: 60000,
      theme: 'ambient_particles_glow',
      archetypeNotes: 'Configured for infinite seamless audio crossfades and procedural visual textures.',
    };
  }
}
