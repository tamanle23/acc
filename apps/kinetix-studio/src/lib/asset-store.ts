// ============================================================================
// KINETIX STUDIO v5.0 - CLIENT-SIDE INDEXEDDB ASSET STORE
// Decouples multi-megabyte binary assets (audio, fonts, images, SVGs) from
// the declarative <900-char URL state contract.
// ============================================================================

const DB_NAME = 'kinetix_studio_assets_v5';
const DB_VERSION = 1;
const STORE_NAME = 'media_assets';

export type AssetType = 'audio' | 'font' | 'svg' | 'vector' | 'image';

export interface StoredAssetRecord {
  key: string;
  type: AssetType;
  data: Blob | ArrayBuffer | string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: number;
}

let dbInstance: IDBDatabase | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in current environment'));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(req.result);
    };

    req.onerror = () => reject(req.error);
  });
}

export async function saveAsset(
  key: string,
  data: Blob | ArrayBuffer | string,
  type: AssetType,
  name = 'asset',
  mimeType = ''
): Promise<void> {
  const db = await getDb();
  const sizeBytes =
    data instanceof Blob
      ? data.size
      : data instanceof ArrayBuffer
      ? data.byteLength
      : typeof data === 'string'
      ? data.length
      : 0;

  const record: StoredAssetRecord = {
    key,
    type,
    data,
    name,
    sizeBytes,
    mimeType,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAsset(key: string): Promise<StoredAssetRecord | null> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteAsset(key: string): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore cleanup errors
  }
}

export async function listAssets(type?: AssetType): Promise<StoredAssetRecord[]> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const records: StoredAssetRecord[] = req.result || [];
        if (type) {
          resolve(
            records.filter((r) =>
              type === 'svg' || type === 'vector'
                ? r.type === 'svg' || r.type === 'vector'
                : r.type === type
            )
          );
        } else {
          resolve(records);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}
