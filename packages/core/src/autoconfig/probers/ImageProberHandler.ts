import fs from 'fs';
import path from 'path';
import { BaseMediaAssetProberHandler } from './BaseMediaAssetProberHandler';
import { CanvasAssetLoader } from '../../isomorphic/canvas';
import type { DiscoveredAssetManifest, DiscoveredVisualAsset, ProberScanOptions } from '../types';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']);

export class ImageProberHandler extends BaseMediaAssetProberHandler {
  public readonly id = 'prober.image';
  public readonly name = 'Image Asset Prober';

  protected canHandle(filePath: string): boolean {
    const ext = this.getExtension(filePath);
    return IMAGE_EXTENSIONS.has(ext);
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
      let aspectRatio: DiscoveredVisualAsset['aspectRatio'] = 'custom';

      // Deep inspection if requested
      if (options?.probeDeepMetadata !== false) {
        try {
          const img = await CanvasAssetLoader.loadImage(filePath);
          width = img.width;
          height = img.height;

          const ratio = width / height;
          if (Math.abs(ratio - 9 / 16) < 0.05) aspectRatio = '9:16';
          else if (Math.abs(ratio - 16 / 9) < 0.05) aspectRatio = '16:9';
          else if (Math.abs(ratio - 1.0) < 0.05) aspectRatio = '1:1';
          else if (Math.abs(ratio - 4 / 5) < 0.05) aspectRatio = '4:5';
        } catch {
          // Non-blocking fallback if canvas cannot read image format
        }
      }

      manifest.visuals.push({
        relativePath,
        absolutePath: path.resolve(filePath),
        fileName,
        baseName,
        extension,
        type: 'image',
        sizeBytes: stats.size,
        width,
        height,
        aspectRatio,
      });

      return true;
    } catch {
      return false;
    }
  }
}
