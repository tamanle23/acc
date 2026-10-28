import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Readable, Writable } from 'node:stream';
import {
  ContentCacheStrategyId,
  type IContentCacheStrategy,
  type CacheEntryMetadata,
  fastChecksum,
  streamToBlob,
} from '@acc/core-isomorphic';

export interface NativeFileCacheOptions {
  baseDir?: string;
}

/**
 * NativeFileCacheStrategy:
 * High-performance server-side file cache strategy utilizing local filesystem.
 * Features first-class streaming and Blob support with zero-copy disk backing on Bun and Node.js.
 * Adheres strictly to GLOBAL-STORAGE by defaulting to ~/.acc/cache/ or specified base directory.
 */
export class NativeFileCacheStrategy implements IContentCacheStrategy {
  public readonly id = ContentCacheStrategyId.NativeFile;
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

  /**
   * Zero-copy streaming retrieval directly from disk.
   */
  public async getStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) return null;

    if (typeof (globalThis as any).Bun !== 'undefined' && typeof (globalThis as any).Bun.file === 'function') {
      return (globalThis as any).Bun.file(filePath).stream();
    }

    if (typeof Readable.toWeb === 'function') {
      const nodeStream = fs.createReadStream(filePath);
      return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    }

    // Custom fallback stream
    const nodeStream = fs.createReadStream(filePath);
    return new ReadableStream<Uint8Array>({
      start(controller) {
        nodeStream.on('data', (chunk: any) => {
          controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        });
        nodeStream.on('end', () => controller.close());
        nodeStream.on('error', (err: any) => controller.error(err));
      },
      cancel() {
        nodeStream.destroy();
      },
    });
  }

  /**
   * Kernel-backed file Blob retrieval.
   * On Bun and Node.js 18+, returns file-backed Blob with zero RAM preloading.
   */
  public async getBlob(key: string): Promise<Blob | null> {
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) return null;

    const meta = await this.getMetadata(key);
    const mimeType = meta?.mimeType || 'application/octet-stream';

    if (typeof (globalThis as any).Bun !== 'undefined' && typeof (globalThis as any).Bun.file === 'function') {
      return (globalThis as any).Bun.file(filePath);
    }

    if (typeof (fs.promises as any).openAsBlob === 'function') {
      return await (fs.promises as any).openAsBlob(filePath, { type: mimeType });
    }

    const buffer = await fs.promises.readFile(filePath);
    return new Blob([buffer], { type: mimeType });
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

  /**
   * Streaming file persistence with zero full-buffer heap buffering.
   */
  public async setStream(
    key: string,
    stream: ReadableStream<Uint8Array>,
    metadata?: Partial<CacheEntryMetadata>
  ): Promise<void> {
    const filePath = this.getFilePath(key);
    const metaPath = this.getMetaPath(key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    const reader = stream.getReader();
    const writeStream = fs.createWriteStream(filePath);
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          await new Promise<void>((resolve, reject) => {
            writeStream.write(value, (err) => (err ? reject(err) : resolve()));
          });
        }
      }
    } finally {
      await new Promise<void>((resolve) => writeStream.end(resolve));
      reader.releaseLock();
    }


    const stat = await fs.promises.stat(filePath).catch(() => ({ size: 0 }));
    const fullMeta: CacheEntryMetadata = {
      checksum: metadata?.checksum || `file_${Date.now()}_${stat.size}`,
      mimeType: metadata?.mimeType || 'application/octet-stream',
      createdAt: metadata?.createdAt || Date.now(),
      sizeBytes: metadata?.sizeBytes ?? stat.size,
      metadata: metadata?.metadata,
    };

    await fs.promises.writeFile(metaPath, JSON.stringify(fullMeta, null, 2), 'utf-8');
  }

  public async setBlob(key: string, blob: Blob, metadata?: Partial<CacheEntryMetadata>): Promise<void> {
    const filePath = this.getFilePath(key);
    const metaPath = this.getMetaPath(key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    if (typeof (globalThis as any).Bun !== 'undefined' && typeof (globalThis as any).Bun.write === 'function') {
      await (globalThis as any).Bun.write(filePath, blob);
    } else {
      await this.setStream(key, blob.stream(), {
        ...metadata,
        mimeType: metadata?.mimeType || blob.type,
        sizeBytes: blob.size,
      });
      return;
    }

    const fullMeta: CacheEntryMetadata = {
      checksum: metadata?.checksum || `blob_${Date.now()}_${blob.size}`,
      mimeType: metadata?.mimeType || blob.type || 'application/octet-stream',
      createdAt: metadata?.createdAt || Date.now(),
      sizeBytes: blob.size,
      metadata: metadata?.metadata,
    };
    await fs.promises.writeFile(metaPath, JSON.stringify(fullMeta, null, 2), 'utf-8');
  }

  public async getMetadata(key: string): Promise<CacheEntryMetadata | null> {
    const metaPath = this.getMetaPath(key);
    try {
      const content = await fs.promises.readFile(metaPath, 'utf-8');
      return JSON.parse(content) as CacheEntryMetadata;
    } catch {
      return null;
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
      return files.filter((f) => !f.endsWith('.meta.json'));
    } catch {
      return [];
    }
  }
}
