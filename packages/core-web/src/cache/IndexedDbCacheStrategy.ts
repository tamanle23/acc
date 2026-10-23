import type { IContentCacheStrategy, CacheEntryMetadata } from '@acc/core-isomorphic';
import { fastChecksum } from '@acc/core-isomorphic';

const DB_NAME = 'acc_content_cache';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;

interface IndexedDbRecord {
  key: string;
  data: ArrayBuffer;
  metadata: CacheEntryMetadata;
}

/**
 * IndexedDbCacheStrategy:
 * Browser client cache strategy utilizing IndexedDB for persistent storage across sessions.
 * Falls back to in-memory Map in non-browser/SSR or test mock environments.
 */
export class IndexedDbCacheStrategy implements IContentCacheStrategy {
  public readonly id = 'indexeddb';
  public readonly name = 'Browser IndexedDB Content Cache';

  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private fallbackMemory: Map<string, { data: Uint8Array; metadata: CacheEntryMetadata }> = new Map();

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
      return item ? item.data : null;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          const res = req.result as IndexedDbRecord | undefined;
          if (!res || !res.data) {
            resolve(null);
          } else {
            resolve(new Uint8Array(res.data));
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
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
}
