import {
  ContentCacheStrategyId,
  type IContentCacheStrategy,
  type CacheEntryMetadata,
  fastChecksum,
  uint8ArrayToStream,
  streamToUint8Array,
} from '@acc/core-isomorphic';
import { IndexedDbCacheStrategy } from './IndexedDbCacheStrategy';

const DEFAULT_OPFS_DIRECTORY = 'acc_content_cache';

export interface OpfsCacheOptions {
  directoryName?: string;
  fallbackStrategy?: IContentCacheStrategy;
}

/**
 * OpfsCacheStrategy:
 * Browser client cache strategy utilizing the Origin Private File System (OPFS).
 * Provides disk-backed, zero-memory-heap storage with first-class WHATWG ReadableStream and Blob support.
 * Designed for Service Workers, Web Workers, and Browser environments to stream large video/audio
 * assets without holding contiguous multi-hundred megabyte arrays in JavaScript VRAM/RAM.
 * Seamlessly falls back to IndexedDbCacheStrategy when OPFS is unsupported.
 */
export class OpfsCacheStrategy implements IContentCacheStrategy {
  public readonly id = ContentCacheStrategyId.Opfs;
  public readonly name = 'Browser Origin Private File System Content Cache';

  private readonly directoryName: string;
  private readonly fallback: IContentCacheStrategy;
  private dirPromise: Promise<FileSystemDirectoryHandle | null> | null = null;

  constructor(options: OpfsCacheOptions = {}) {
    this.directoryName = options.directoryName || DEFAULT_OPFS_DIRECTORY;
    this.fallback = options.fallbackStrategy || new IndexedDbCacheStrategy();
  }

  /**
   * Detects whether OPFS is available in current execution context.
   */
  public isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.storage &&
      typeof navigator.storage.getDirectory === 'function'
    );
  }

  private async getDirectory(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.isSupported()) {
      return null;
    }

    if (!this.dirPromise) {
      this.dirPromise = (async () => {
        try {
          const root = await navigator.storage.getDirectory();
          return await root.getDirectoryHandle(this.directoryName, { create: true });
        } catch {
          return null;
        }
      })();
    }

    return this.dirPromise;
  }

  private sanitizeKey(key: string): string {
    return encodeURIComponent(key).replace(/%/g, '_');
  }

  public async has(key: string): Promise<boolean> {
    const dir = await this.getDirectory();
    if (!dir) {
      return this.fallback.has(key);
    }

    const safeName = this.sanitizeKey(key);
    try {
      await dir.getFileHandle(safeName);
      return true;
    } catch {
      return false;
    }
  }

  public async get(key: string): Promise<Uint8Array | null> {
    const dir = await this.getDirectory();
    if (!dir) {
      return this.fallback.get(key);
    }

    const safeName = this.sanitizeKey(key);
    try {
      const handle = await dir.getFileHandle(safeName);
      const file = await handle.getFile();
      const buffer = await file.arrayBuffer();
      return new Uint8Array(buffer);
    } catch {
      return null;
    }
  }

  public async set(
    key: string,
    data: Uint8Array,
    metadata?: Partial<CacheEntryMetadata>
  ): Promise<void> {
    const dir = await this.getDirectory();
    if (!dir) {
      return this.fallback.set(key, data, metadata);
    }

    const safeName = this.sanitizeKey(key);
    const handle = await dir.getFileHandle(safeName, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(data as unknown as ArrayBufferView);
    } finally {
      await writable.close();
    }

    // Persist companion metadata
    const meta: CacheEntryMetadata = {
      checksum: metadata?.checksum || fastChecksum(data),
      mimeType: metadata?.mimeType || 'application/octet-stream',
      createdAt: metadata?.createdAt || Date.now(),
      sizeBytes: data.byteLength,
      metadata: metadata?.metadata,
    };
    await this.writeMetadata(dir, safeName, meta);
  }

  public async getBlob(key: string): Promise<Blob | null> {
    const dir = await this.getDirectory();
    if (!dir) {
      if (typeof this.fallback.getBlob === 'function') {
        return this.fallback.getBlob(key);
      }
      const data = await this.fallback.get(key);
      return data ? new Blob([data as unknown as BlobPart]) : null;
    }

    const safeName = this.sanitizeKey(key);
    try {
      const handle = await dir.getFileHandle(safeName);
      return await handle.getFile();
    } catch {
      return null;
    }
  }

  public async setBlob(
    key: string,
    blob: Blob,
    metadata?: Partial<CacheEntryMetadata>
  ): Promise<void> {
    const dir = await this.getDirectory();
    if (!dir) {
      if (typeof this.fallback.setBlob === 'function') {
        return this.fallback.setBlob(key, blob, metadata);
      }
      const data = new Uint8Array(await blob.arrayBuffer());
      return this.fallback.set(key, data, metadata);
    }

    const safeName = this.sanitizeKey(key);
    const handle = await dir.getFileHandle(safeName, { create: true });
    const writable = await handle.createWritable();
    try {
      // Pipe blob stream directly to OPFS writable without intermediate heap allocation
      await blob.stream().pipeTo(writable);
    } finally {
      try {
        await writable.close();
      } catch {
        // Ignore if already closed by pipeTo
      }
    }

    const meta: CacheEntryMetadata = {
      checksum: metadata?.checksum || `opfs-blob-${Date.now()}`,
      mimeType: metadata?.mimeType || blob.type || 'application/octet-stream',
      createdAt: metadata?.createdAt || Date.now(),
      sizeBytes: metadata?.sizeBytes ?? blob.size,
      metadata: metadata?.metadata,
    };
    await this.writeMetadata(dir, safeName, meta);
  }

  public async getStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const dir = await this.getDirectory();
    if (!dir) {
      if (typeof this.fallback.getStream === 'function') {
        return this.fallback.getStream(key);
      }
      const data = await this.fallback.get(key);
      return data ? uint8ArrayToStream(data) : null;
    }

    const safeName = this.sanitizeKey(key);
    try {
      const handle = await dir.getFileHandle(safeName);
      const file = await handle.getFile();
      return file.stream();
    } catch {
      return null;
    }
  }

  public async setStream(
    key: string,
    stream: ReadableStream<Uint8Array>,
    metadata?: Partial<CacheEntryMetadata>
  ): Promise<void> {
    const dir = await this.getDirectory();
    if (!dir) {
      if (typeof this.fallback.setStream === 'function') {
        return this.fallback.setStream(key, stream, metadata);
      }
      const data = await streamToUint8Array(stream);
      return this.fallback.set(key, data, metadata);
    }

    const safeName = this.sanitizeKey(key);
    const handle = await dir.getFileHandle(safeName, { create: true });
    const writable = await handle.createWritable();
    try {
      await stream.pipeTo(writable);
    } finally {
      try {
        await writable.close();
      } catch {
        // Ignore if closed
      }
    }

    const meta: CacheEntryMetadata = {
      checksum: metadata?.checksum || `opfs-stream-${Date.now()}`,
      mimeType: metadata?.mimeType || 'application/octet-stream',
      createdAt: metadata?.createdAt || Date.now(),
      sizeBytes: metadata?.sizeBytes,
      metadata: metadata?.metadata,
    };
    await this.writeMetadata(dir, safeName, meta);
  }

  public async getMetadata(key: string): Promise<CacheEntryMetadata | null> {
    const dir = await this.getDirectory();
    if (!dir) {
      if (typeof this.fallback.getMetadata === 'function') {
        return this.fallback.getMetadata(key);
      }
      return null;
    }

    const safeName = this.sanitizeKey(key);
    try {
      const metaHandle = await dir.getFileHandle(`${safeName}.meta.json`);
      const file = await metaHandle.getFile();
      const text = await file.text();
      return JSON.parse(text) as CacheEntryMetadata;
    } catch {
      // Fallback: derive basic metadata from the file handle directly
      try {
        const handle = await dir.getFileHandle(safeName);
        const file = await handle.getFile();
        return {
          checksum: `opfs-derived-${file.lastModified}`,
          mimeType: file.type || 'application/octet-stream',
          createdAt: file.lastModified,
          sizeBytes: file.size,
        };
      } catch {
        return null;
      }
    }
  }

  public async delete(key: string): Promise<boolean> {
    const dir = await this.getDirectory();
    if (!dir) {
      return this.fallback.delete(key);
    }

    const safeName = this.sanitizeKey(key);
    let deleted = false;
    try {
      await dir.removeEntry(safeName);
      deleted = true;
    } catch {}

    try {
      await dir.removeEntry(`${safeName}.meta.json`);
    } catch {}

    return deleted;
  }

  public async clear(): Promise<void> {
    const dir = await this.getDirectory();
    if (!dir) {
      return this.fallback.clear();
    }

    try {
      // Modern OPFS iteration
      const entriesIterator = (dir as unknown as { values?: () => AsyncIterable<FileSystemHandle> }).values?.();
      if (entriesIterator) {
        for await (const entry of entriesIterator) {
          try {
            await dir.removeEntry(entry.name, { recursive: true });
          } catch {}
        }
      } else {
        // Fallback to removing directory from root and recreating
        const root = await navigator.storage.getDirectory();
        await root.removeEntry(this.directoryName, { recursive: true });
        this.dirPromise = null;
      }
    } catch {
      this.dirPromise = null;
    }
  }

  public async getKeys(): Promise<string[]> {
    const dir = await this.getDirectory();
    if (!dir) {
      if (typeof this.fallback.getKeys === 'function') {
        return this.fallback.getKeys();
      }
      return [];
    }

    const keys: string[] = [];
    try {
      const entriesIterator = (dir as unknown as { values?: () => AsyncIterable<FileSystemHandle> }).values?.();
      if (entriesIterator) {
        for await (const entry of entriesIterator) {
          if (!entry.name.endsWith('.meta.json')) {
            keys.push(decodeURIComponent(entry.name.replace(/_/g, '%')));
          }
        }
      }
    } catch {}

    return keys;
  }

  private async writeMetadata(
    dir: FileSystemDirectoryHandle,
    safeName: string,
    metadata: CacheEntryMetadata
  ): Promise<void> {
    try {
      const metaHandle = await dir.getFileHandle(`${safeName}.meta.json`, { create: true });
      const writable = await metaHandle.createWritable();
      try {
        const text = JSON.stringify(metadata);
        await writable.write(text);
      } finally {
        await writable.close();
      }
    } catch {}
  }
}
