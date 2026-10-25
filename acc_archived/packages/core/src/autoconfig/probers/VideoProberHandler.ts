import fs from 'fs';
import path from 'path';
import { BaseMediaAssetProberHandler } from './BaseMediaAssetProberHandler';
import type { DiscoveredAssetManifest, DiscoveredVisualAsset, ProberScanOptions } from '../types';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi']);

export class VideoProberHandler extends BaseMediaAssetProberHandler {
  public readonly id = 'prober.video';
  public readonly name = 'Video Asset Prober';

  protected canHandle(filePath: string): boolean {
    const ext = this.getExtension(filePath);
    return VIDEO_EXTENSIONS.has(ext);
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

      let width: number | undefined;
      let height: number | undefined;
      let durationMs: number | undefined;
      let fps: number | undefined;
      let aspectRatio: DiscoveredVisualAsset['aspectRatio'] = 'custom';

      // Deep probe if requested
      if (options?.probeDeepMetadata) {
        try {
          const { AssetMetadataProber } = await import('@acc/ir');
          const prober = new AssetMetadataProber(baseDir);
          const meta = await prober.probe(filePath);
          width = meta.width;
          height = meta.height;
          fps = meta.fps;
          if (meta.durationFrames && meta.fps) {
            durationMs = Math.round((meta.durationFrames / meta.fps) * 1000);
          }
          if (width && height) {
            const ratio = width / height;
            if (Math.abs(ratio - 9 / 16) < 0.05) aspectRatio = '9:16';
            else if (Math.abs(ratio - 16 / 9) < 0.05) aspectRatio = '16:9';
            else if (Math.abs(ratio - 1.0) < 0.05) aspectRatio = '1:1';
            else if (Math.abs(ratio - 4 / 5) < 0.05) aspectRatio = '4:5';
          }
        } catch {
          // Non-blocking fallback if native prober is offline
        }
      }

      manifest.visuals.push({
        relativePath,
        absolutePath: path.resolve(filePath),
        fileName,
        baseName,
        extension,
        type: 'video',
        sizeBytes: stats.size,
        width,
        height,
        durationMs,
        fps,
        aspectRatio,
      });

      return true;
    } catch {
      return false;
    }
  }
}
