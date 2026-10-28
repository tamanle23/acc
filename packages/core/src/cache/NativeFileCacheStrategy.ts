import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Readable, Writable } from 'node:stream';
import {
  ContentCacheStrategyId,
  type IContentCacheStrategy,
  type CachePayload,
  type CacheEntryMetadata,
  fastChecksum,
  payloadToBlob,
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

  /**
   * First-class Web standard Blob retrieval.
   * On Bun and Node.js 18+, returns file-backed Blob with zero RAM preloading.
   */
  public async get(key: string): Promise<Blob | null> {
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

  /**
   * Standardized polymorphic persistence.
   * Directly supports Blob, WHATWG ReadableStream<Uint8Array>, ArrayBuffer, ArrayBufferView, or string.
   */
  public async set(
    key: string,
    data: CachePayload,
    metadata?: Partial<CacheEntryMetadata>
  ): Promise<void> {
    const filePath = this.getFilePath(key);
    const metaPath = this.getMetaPath(key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    const blob = await payloadToBlob(data, metadata?.mimeType);

    if (typeof (globalThis as any).Bun !== 'undefined' && typeof (globalThis as any).Bun.write === 'function') {
      await (globalThis as any).Bun.write(filePath, blob);
    } else {
      const writable = await this.createWritableStream(key, metadata);
      await blob.stream().pipeTo(writable);
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

  /**
   * Opens a WHATWG WritableStream directly into disk storage for zero-copy streaming ingestion.
   */
  public async createWritableStream(
    key: string,
    metadata?: Partial<CacheEntryMetadata>
  ): Promise<WritableStream<Uint8Array>> {
    const filePath = this.getFilePath(key);
    const metaPath = this.getMetaPath(key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    const writeStream = fs.createWriteStream(filePath);
    let totalBytes = 0;

    const finalizeMeta = async () => {
      const fullMeta: CacheEntryMetadata = {
        checksum: metadata?.checksum || `stream_${Date.now()}_${totalBytes}`,
        mimeType: metadata?.mimeType || 'application/octet-stream',
        createdAt: metadata?.createdAt || Date.now(),
        sizeBytes: metadata?.sizeBytes ?? totalBytes,
        metadata: metadata?.metadata,
      };
      await fs.promises.writeFile(metaPath, JSON.stringify(fullMeta, null, 2), 'utf-8');
    };

    if (typeof Writable.toWeb === 'function') {
      const webWritable = Writable.toWeb(writeStream) as WritableStream<Uint8Array>;
      return new WritableStream<Uint8Array>({
        async write(chunk, controller) {
          totalBytes += chunk.byteLength;
          const writer = webWritable.getWriter();
          try {
            await writer.write(chunk);
          } finally {
            writer.releaseLock();
          }
        },
        async close() {
          await finalizeMeta();
        },
        async abort(reason) {
          writeStream.destroy(reason instanceof Error ? reason : new Error(String(reason)));
        },
      });
    }

    return new WritableStream<Uint8Array>({
      async write(chunk) {
        totalBytes += chunk.byteLength;
        await new Promise<void>((resolve, reject) => {
          writeStream.write(chunk, (err) => (err ? reject(err) : resolve()));
        });
      },
      async close() {
        await new Promise<void>((resolve) => writeStream.end(resolve));
        await finalizeMeta();
      },
      abort(reason) {
        writeStream.destroy(reason instanceof Error ? reason : new Error(String(reason)));
      },
    });
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
