/**
 * Universal Isomorphic Content Cache Strategy Types
 */

export enum ContentCacheStrategyId {
  Memory = 'memory',
  NativeFile = 'native-file',
  IndexedDb = 'indexeddb',
  WebCache = 'web-cache',
}

export interface CacheEntryMetadata {
  checksum: string;
  mimeType?: string;
  createdAt: number;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
}

export interface IContentCacheStrategy {
  readonly id: ContentCacheStrategyId | string;
  readonly name: string;

  has(key: string): Promise<boolean>;
  get(key: string): Promise<Uint8Array | null>;
  set(key: string, data: Uint8Array, metadata?: Partial<CacheEntryMetadata>): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  getKeys?(): Promise<string[]>;
}
