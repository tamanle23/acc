import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { IContentCacheStrategy, CacheEntryMetadata } from '@acc/core-isomorphic';
import { fastChecksum } from '@acc/core-isomorphic';

export interface NativeFileCacheOptions {
  baseDir?: string;
}

/**
 * NativeFileCacheStrategy:
 * High-performance server-side file cache strategy utilizing local filesystem.
 * Adheres strictly to GLOBAL-STORAGE by defaulting to ~/.acc/cache/ or specified base directory.
 */
export class NativeFileCacheStrategy implements IContentCacheStrategy {
  public readonly id = 'native-file';
  public readonly name = 'Server Local File System Cache';

  private baseDir: string;

  constructor(options: NativeFileCacheOptions = {}) {
    this.baseDir = options.baseDir || path.join(os.homedir(), '.acc', 'cache');
    if (!fs.existsSync(this.baseDir)) {
      try {
        fs.mkdirSync(this.baseDir, { recursive: true });
      } catch {}
    }
  }

  private getFilePath(key: string): string {
    // Sanitize key for safe filesystem usage
    const safeKey = key.replace(/[^a-zA-Z0-9_\-.]/g, '_');
    return path.join(this.baseDir, safeKey);
  }

  private getMetaPath(key: string): string {
    return `${this.getFilePath(key)}.meta.json`;
  }

  public async has(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  public async get(key: string): Promise<Uint8Array | null> {
    const filePath = this.getFilePath(key);
    try {
      const buffer = await fs.promises.readFile(filePath);
      return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } catch {
      return null;
    }
  }

  public async set(key: string, data: Uint8Array, metadata?: Partial<CacheEntryMetadata>): Promise<void> {
    const filePath = this.getFilePath(key);
    const metaPath = this.getMetaPath(key);

    const fullMeta: CacheEntryMetadata = {
      checksum: metadata?.checksum || fastChecksum(data),
      mimeType: metadata?.mimeType || 'application/octet-stream',
      createdAt: metadata?.createdAt || Date.now(),
      sizeBytes: data.byteLength,
      metadata: metadata?.metadata,
    };

    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      await fs.promises.writeFile(filePath, data);
      await fs.promises.writeFile(metaPath, JSON.stringify(fullMeta, null, 2), 'utf-8');
    } catch (err) {
      throw new Error(`[NativeFileCacheStrategy] Failed to write cache for key "${key}": ${err}`);
    }
  }

  public async delete(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    const metaPath = this.getMetaPath(key);

    let deleted = false;
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        deleted = true;
      }
      if (fs.existsSync(metaPath)) {
        await fs.promises.unlink(metaPath);
      }
    } catch {
      return false;
    }
    return deleted;
  }

  public async clear(): Promise<void> {
    try {
      if (fs.existsSync(this.baseDir)) {
        const files = await fs.promises.readdir(this.baseDir);
        for (const file of files) {
          try {
            await fs.promises.unlink(path.join(this.baseDir, file));
          } catch {}
        }
      }
    } catch {}
  }

  public async getKeys(): Promise<string[]> {
    try {
      if (!fs.existsSync(this.baseDir)) return [];
      const files = await fs.promises.readdir(this.baseDir);
      return files.filter(f => !f.endsWith('.meta.json'));
    } catch {
      return [];
    }
  }
}
