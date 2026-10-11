import fs from 'fs';
import path from 'path';
import { BaseMediaAssetProberHandler } from './BaseMediaAssetProberHandler';
import type { DiscoveredAssetManifest, ProberScanOptions } from '../types';

const SCRIPT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.srt', '.vtt']);

export class ScriptProberHandler extends BaseMediaAssetProberHandler {
  public readonly id = 'prober.script';
  public readonly name = 'Script & Text Prober';

  protected canHandle(filePath: string): boolean {
    const ext = this.getExtension(filePath);
    const fileName = path.basename(filePath);
    if (/^readme\./i.test(fileName)) {
      return false;
    }
    return SCRIPT_EXTENSIONS.has(ext);
  }

  protected async processFile(
    filePath: string,
    baseDir: string,
    manifest: DiscoveredAssetManifest,
    _options?: ProberScanOptions
  ): Promise<boolean> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const fileName = path.basename(filePath);
      const extension = this.getExtension(filePath);
      const relativePath = this.getRelativePath(filePath, baseDir);

      // Split into clean script lines
      const lines = content
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

      const words = content.trim().split(/\s+/).filter(Boolean);
      const wordCount = words.length;

      // Rule of thumb: ~150 words per minute = 2.5 words/sec = 400ms per word
      const estimatedSpeechDurationMs = Math.round(wordCount * 400);

      manifest.scripts.push({
        relativePath,
        absolutePath: path.resolve(filePath),
        fileName,
        extension,
        content,
        lines,
        wordCount,
        estimatedSpeechDurationMs,
      });

      return true;
    } catch {
      return false;
    }
  }
}
