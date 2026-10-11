import fs from 'fs';
import path from 'path';
import type {
  IPipelineClassifierStrategy,
  DiscoveredAssetManifest,
  ArchetypeScaffoldConfig,
} from '../types';

export class GenerativeStoryClassifierStrategy implements IPipelineClassifierStrategy {
  public readonly pipelineId = '4';
  public readonly name = 'Generative Storytelling Pipeline';
  public readonly description = 'Sequential visual storyboards, AI illustrated scenes, paired narrations, and 3D depth.';

  public calculateConfidence(manifest: DiscoveredAssetManifest): number {
    // Definitive indicator: If folder already contains native story-config.json (not bridge-adapted from another pipeline)
    const storyConfigPath = path.join(manifest.baseDir, 'story-config.json');
    if (fs.existsSync(storyConfigPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8'));
        const desc = raw.description || '';
        // If adapted from another pipeline, don't hijack classification
        const match = desc.match(/Adapted from Pipeline \[([^\]]+)\]/);
        if (!match || match[1] === '4' || match[1] === 'generative-storytelling') {
          return 1.0;
        }
      } catch {
        return 1.0;
      }
    }

    const images = manifest.visuals.filter((v) => v.type === 'image');
    const videos = manifest.visuals.filter((v) => v.type === 'video');
    const voiceovers = manifest.audio.filter((a) => a.classification === 'voiceover');

    // Canonical storyboard signature: multiple image scenes, especially paired with voiceovers
    if (images.length >= 2 && images.length >= videos.length) {
      if (manifest.pairedPairs.length >= 2 && (voiceovers.length > 0 || manifest.scripts.length > 0)) {
        return 0.98;
      }
      if (manifest.hasVoiceover || manifest.hasBackgroundMusic) {
        return 0.92;
      }
      return 0.88;
    }

    if (images.length >= 1 && videos.length === 0) {
      return 0.65;
    }

    // Default baseline fallback
    return 0.25;
  }

  public generateArchetypeDefaults(manifest: DiscoveredAssetManifest): ArchetypeScaffoldConfig {
    return {
      pipelineId: this.pipelineId,
      canonicalPipelineId: 'generative-storytelling',
      suggestedTitle: manifest.suggestedTitle || 'Visual Storytelling Narrative',
      suggestedModalities: ['video', 'social', 'audio'],
      defaultAspect: manifest.dominantVisualAspect || '9:16',
      defaultFps: 30,
      chunkDurationMs: 5000,
      theme: '3d_sandwich',
      archetypeNotes: 'Configured for multi-plane 3D depth, Ken Burns cinematography, and voiceover synchronization.',
    };
  }
}
