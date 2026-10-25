import fs from 'fs';
import path from 'path';
import { BaseMediaAssetProberHandler } from './BaseMediaAssetProberHandler';
import type { DiscoveredAssetManifest, DiscoveredAudioAsset, ProberScanOptions } from '../types';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac']);

export class AudioProberHandler extends BaseMediaAssetProberHandler {
  public readonly id = 'prober.audio';
  public readonly name = 'Audio Asset Prober';

  protected canHandle(filePath: string): boolean {
    const ext = this.getExtension(filePath);
    return AUDIO_EXTENSIONS.has(ext);
  }

  protected async processFile(
    filePath: string,
    baseDir: string,
    manifest: DiscoveredAssetManifest,
    options?: ProberScanOptions
  ): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(filePath);
      const fileName = path.basename(filePath);
      const baseName = this.getBaseName(filePath);
      const extension = this.getExtension(filePath);
      const relativePath = this.getRelativePath(filePath, baseDir);
      const lower = fileName.toLowerCase();

      // Semantic Classification Heuristics
      let classification: DiscoveredAudioAsset['classification'] = 'unknown';

      if (/(bgm|music|soundtrack|beat|theme|instrumental|ambient_loop)/i.test(lower)) {
        classification = 'music';
      } else if (/(sfx|whoosh|impact|click|bass_drop|riser|transition)/i.test(lower)) {
        classification = 'sfx';
      } else if (/(voice|vo|speech|narration|audio_\d+|scene_\d+|chunk_\d+)/i.test(lower)) {
        classification = 'voiceover';
      } else if (/(ambient|rain|wind|forest|nature|drone)/i.test(lower)) {
        classification = 'ambient';
      } else {
        // Fallback default based on naming
        classification = lower.includes('bgm') ? 'music' : 'voiceover';
      }

      manifest.audio.push({
        relativePath,
        absolutePath: path.resolve(filePath),
        fileName,
        baseName,
        extension,
        sizeBytes: stats.size,
        classification,
      });

      return true;
    } catch {
      return false;
    }
  }
}
