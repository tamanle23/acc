import fs from 'fs';
import path from 'path';
import type {
  IPipelineClassifierStrategy,
  DiscoveredAssetManifest,
  ArchetypeScaffoldConfig,
} from '../types';

export class RepurposingClassifierStrategy implements IPipelineClassifierStrategy {
  public readonly pipelineId = '3';
  public readonly name = 'Repurposing Recycler Pipeline';
  public readonly description = 'Long-form podcasts, webinars, interviews, and video highlights recycled into vertical shorts.';

  public calculateConfidence(manifest: DiscoveredAssetManifest): number {
    // If folder has native story-config.json (not bridge-adapted from another pipeline), it's explicitly Pipeline 4
    const storyConfigPath = path.join(manifest.baseDir, 'story-config.json');
    if (fs.existsSync(storyConfigPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(storyConfigPath, 'utf-8'));
        const desc = raw.description || '';
        const match = desc.match(/Adapted from Pipeline \[([^\]]+)\]/);
        if (!match || match[1] === '4' || match[1] === 'generative-storytelling') {
          return 0.05;
        }
      } catch {
        return 0.05;
      }
    }

    // Ignore rendered output video files (e.g. final.mp4, test_*.mp4, .temp_*)
    const rawVideoFiles = manifest.visuals.filter(
      (v) =>
        v.type === 'video' &&
        !/^(final|output|test|\.temp|ir_cli)/i.test(v.fileName)
    );
    const imageFiles = manifest.visuals.filter((v) => v.type === 'image');

    // If sequential images dominate, it's not repurposing
    if (imageFiles.length >= 2 && imageFiles.length > rawVideoFiles.length) {
      return 0.2;
    }

    // Long-form video source file present
    if (rawVideoFiles.length > 0) {
      const hasLongVideo = rawVideoFiles.some(
        (v) => (v.durationMs && v.durationMs > 30000) || v.sizeBytes > 5 * 1024 * 1024
      );

      if (rawVideoFiles.length <= 2 && hasLongVideo && imageFiles.length === 0) return 0.98;
      if (rawVideoFiles.length <= 3 && imageFiles.length === 0) return 0.92;
      if (imageFiles.length > 0 && rawVideoFiles.length > 0) return 0.55;
      return 0.85;
    }

    return 0.05;
  }

  public generateArchetypeDefaults(manifest: DiscoveredAssetManifest): ArchetypeScaffoldConfig {
    return {
      pipelineId: this.pipelineId,
      canonicalPipelineId: 'repurposing-recycler',
      suggestedTitle: manifest.suggestedTitle || 'Viral Video Highlight',
      suggestedModalities: ['video', 'social'],
      defaultAspect: '9:16', // Always vertical crop for repurposed shorts
      defaultFps: 30,
      chunkDurationMs: 30000,
      theme: 'tiktok_karaoke_glow',
      archetypeNotes: 'Configured for auto-reframe face tracking, emphasis punch-ins, and animated kinetic subtitles.',
    };
  }
}
