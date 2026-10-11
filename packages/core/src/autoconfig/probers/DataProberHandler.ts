import fs from 'fs';
import path from 'path';
import { BaseMediaAssetProberHandler } from './BaseMediaAssetProberHandler';
import type { DiscoveredAssetManifest, ProberScanOptions } from '../types';

export class DataProberHandler extends BaseMediaAssetProberHandler {
  public readonly id = 'prober.data';
  public readonly name = 'Structured Data Prober';

  protected canHandle(filePath: string): boolean {
    const ext = this.getExtension(filePath);
    return ext === '.csv' || ext === '.json';
  }

  protected async processFile(
    filePath: string,
    baseDir: string,
    manifest: DiscoveredAssetManifest,
    _options?: ProberScanOptions
  ): Promise<boolean> {
    try {
      const fileName = path.basename(filePath);
      const ext = this.getExtension(filePath);
      const relativePath = this.getRelativePath(filePath, baseDir);

      // Avoid probing pipeline-ir.json or story-config.json or package.json as dataset files
      if (/^(package|tsconfig|story-config|pipeline-ir|omnichannel-config)/i.test(fileName)) {
        return false;
      }

      const content = await fs.promises.readFile(filePath, 'utf-8');

      if (ext === '.csv') {
        const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const headers = lines[0] ? lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, '')) : [];
        manifest.data.push({
          relativePath,
          absolutePath: path.resolve(filePath),
          fileName,
          extension: 'csv',
          rowCount: Math.max(0, lines.length - 1),
          headers,
        });
        return true;
      } else if (ext === '.json') {
        const parsed = JSON.parse(content);
        const isArray = Array.isArray(parsed);
        const rowCount = isArray ? parsed.length : 1;
        const headers = isArray && parsed[0] && typeof parsed[0] === 'object'
          ? Object.keys(parsed[0] as Record<string, unknown>)
          : undefined;

        manifest.data.push({
          relativePath,
          absolutePath: path.resolve(filePath),
          fileName,
          extension: 'json',
          rowCount,
          headers,
          sampleData: isArray ? parsed.slice(0, 3) : parsed,
        });
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }
}
