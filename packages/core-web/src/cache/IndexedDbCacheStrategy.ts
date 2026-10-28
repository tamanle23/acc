import {
  ContentCacheStrategyId,
  type IContentCacheStrategy,
  type CachePayload,
  type CacheEntryMetadata,
  fastChecksum,
  payloadToBlob,
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

/**
 * IndexedDbCacheStrategy:
 * Browser client cache strategy utilizing IndexedDB for persistent storage across sessions.
 * Features first-class Blob and Streaming support with zero-copy disk backing.
 * Strictly operates on its own capacity (IndexedDB) with zero in-memory fallback retention.
 */
export class IndexedDbCacheStrategy implements IContentCacheStrategy {
  public readonly id = ContentCacheStrategyId.IndexedDb;
  public readonly name = 'Browser IndexedDB Content Cache';

  private dbPromise: Promise<IDBDatabase | null> | null = null;

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
      return false;
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

  public async get(key: string): Promise<Blob | null> {
    const db = await this.getDB();
    if (!db) {
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

  public async set(
    key: string,
    data: CachePayload,
    metadata?: Partial<CacheEntryMetadata>
  ): Promise<void> {
    const blob = await payloadToBlob(data, metadata?.mimeType);
    const fullMeta: CacheEntryMetadata = {
      checksum: metadata?.checksum || `blob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      mimeType: metadata?.mimeType || blob.type || 'application/octet-stream',
      createdAt: metadata?.createdAt || Date.now(),
      sizeBytes: blob.size,
      metadata: metadata?.metadata,
    };

    const db = await this.getDB();
    if (!db) {
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

  public async createWritableStream(
    key: string,
    metadata?: Partial<CacheEntryMetadata>
  ): Promise<WritableStream<Uint8Array>> {
    const chunks: Uint8Array[] = [];
    return new WritableStream<Uint8Array>({
      write(chunk) {
        chunks.push(chunk);
      },
      close: async () => {
        const blob = new Blob(chunks, { type: metadata?.mimeType || 'application/octet-stream' });
        await this.set(key, blob, metadata);
      },
    });
  }

  public async getMetadata(key: string): Promise<CacheEntryMetadata | null> {
    const db = await this.getDB();
    if (!db) {
      return null;
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
      return false;
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
      return [];
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
