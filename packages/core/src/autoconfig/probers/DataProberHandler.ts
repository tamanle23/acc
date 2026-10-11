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

      // Avoid probing pipeline-ir.json, story-config.json, schema files, or package.json as datasets
      if (
        /^(package|tsconfig|story-config|pipeline-ir|omnichannel-config|video-ir)/i.test(
          fileName
        ) ||
        fileName.includes('schema') ||
        fileName.includes('transformed')
      ) {
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
        if (parsed.$schema || parsed.scenes || parsed.tracks || parsed.settings) {
          return false;
        }

        const isArray =
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          typeof parsed[0] === 'object' &&
          parsed[0] !== null;

        if (!isArray) {
          return false;
        }

        const rowCount = parsed.length;
        const headers = Object.keys(parsed[0] as Record<string, unknown>);

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
