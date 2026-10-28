import {
  ContentCacheStrategyId,
  type IContentCacheStrategy,
  type CacheEntryMetadata,
  fastChecksum,
  streamToBlob,
  blobToStream,
  uint8ArrayToStream,
  blobToUint8Array,
} from '@acc/core-isomorphic';

const DB_NAME = 'acc_content_cache';
const STORE_NAME = 'blobs';
const DB_VERSION = 2; // Incremented for blob-first schema

interface IndexedDbRecord {
  key: string;
  data?: ArrayBuffer;
  blob?: Blob;
  metadata: CacheEntryMetadata;
}

interface FallbackMemoryItem {
  data?: Uint8Array;
  blob?: Blob;
  metadata: CacheEntryMetadata;
}

/**
 * IndexedDbCacheStrategy:
 * Browser client cache strategy utilizing IndexedDB for persistent storage across sessions.
 * Features first-class Blob and Streaming support with zero-copy disk backing.
 * Falls back to in-memory Map in non-browser/SSR or test mock environments.
 */
export class IndexedDbCacheStrategy implements IContentCacheStrategy {
  public readonly id = ContentCacheStrategyId.IndexedDb;
  public readonly name = 'Browser IndexedDB Content Cache';

  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private fallbackMemory: Map<string, FallbackMemoryItem> = new Map();

  private getDB(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const req = indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    }

    return this.dbPromise;
  }

  public async has(key: string): Promise<boolean> {
    const db = await this.getDB();
    if (!db) {
      return this.fallbackMemory.has(key);
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.count(key);
        req.onsuccess = () => resolve(req.result > 0);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  public async get(key: string): Promise<Uint8Array | null> {
    const db = await this.getDB();
    if (!db) {
      const item = this.fallbackMemory.get(key);
      if (!item) return null;
      if (item.data) return item.data;
      if (item.blob) return await blobToUint8Array(item.blob);
      return null;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = async () => {
          const res = req.result as IndexedDbRecord | undefined;
          if (!res) {
            resolve(null);
          } else if (res.data) {
            resolve(new Uint8Array(res.data));
          } else if (res.blob) {
            resolve(await blobToUint8Array(res.blob));
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public async getBlob(key: string): Promise<Blob | null> {
    const db = await this.getDB();
    if (!db) {
      const item = this.fallbackMemory.get(key);
      if (!item) return null;
      if (item.blob) return item.blob;
      if (item.data) {
        return new Blob([item.data], { type: item.metadata.mimeType || 'application/octet-stream' });
      }
      return null;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          const res = req.result as IndexedDbRecord | undefined;
          if (!res) {
            resolve(null);
          } else if (res.blob) {
            resolve(res.blob);
          } else if (res.data) {
            resolve(new Blob([res.data], { type: res.metadata.mimeType || 'application/octet-stream' }));
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public async getStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const blob = await this.getBlob(key);
    return blob ? blobToStream(blob) : null;
  }

  public async set(key: string, data: Uint8Array, metadata?: Partial<CacheEntryMetadata>): Promise<void> {
    const fullMeta: CacheEntryMetadata = {
      checksum: metadata?.checksum || fastChecksum(data),
      mimeType: metadata?.mimeType || 'application/octet-stream',
      createdAt: metadata?.createdAt || Date.now(),
      sizeBytes: data.byteLength,
      metadata: metadata?.metadata,
    };

    const db = await this.getDB();
    if (!db) {
      this.fallbackMemory.set(key, { data, metadata: fullMeta });
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const record: IndexedDbRecord = {
          key,
          data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
          metadata: fullMeta,
        };
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async setBlob(key: string, blob: Blob, metadata?: Partial<CacheEntryMetadata>): Promise<void> {
    const fullMeta: CacheEntryMetadata = {
      checksum: metadata?.checksum || `blob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      mimeType: metadata?.mimeType || blob.type || 'application/octet-stream',
      createdAt: metadata?.createdAt || Date.now(),
      sizeBytes: blob.size,
      metadata: metadata?.metadata,
    };

    const db = await this.getDB();
    if (!db) {
      this.fallbackMemory.set(key, { blob, metadata: fullMeta });
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const record: IndexedDbRecord = {
          key,
          blob,
          metadata: fullMeta,
        };
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async setStream(
    key: string,
    stream: ReadableStream<Uint8Array>,
    metadata?: Partial<CacheEntryMetadata>
  ): Promise<void> {
    const mimeType = metadata?.mimeType || 'application/octet-stream';
    const blob = await streamToBlob(stream, mimeType);
    await this.setBlob(key, blob, metadata);
  }

  public async getMetadata(key: string): Promise<CacheEntryMetadata | null> {
    const db = await this.getDB();
    if (!db) {
      const item = this.fallbackMemory.get(key);
      return item ? item.metadata : null;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          const res = req.result as IndexedDbRecord | undefined;
          resolve(res ? res.metadata : null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public async delete(key: string): Promise<boolean> {
    const db = await this.getDB();
    if (!db) {
      return this.fallbackMemory.delete(key);
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  public async clear(): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      this.fallbackMemory.clear();
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  public async getKeys(): Promise<string[]> {
    const db = await this.getDB();
    if (!db) {
      return Array.from(this.fallbackMemory.keys());
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAllKeys();
        req.onsuccess = () => resolve((req.result as string[]) || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }
}
