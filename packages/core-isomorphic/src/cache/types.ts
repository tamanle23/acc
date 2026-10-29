/**
 * Universal Isomorphic Content Cache Strategy Types
 */

export enum ContentCacheStrategyId {
  NativeFile = 'native-file',
  IndexedDb = 'indexeddb',
  WebCache = 'web-cache',
  Opfs = 'opfs',
}

export enum CacheNamespace {
  Assets = 'assets',
  Textures = 'textures',
  Audio = 'audio',
  Models = 'models',
  VFX = 'vfx',
  Temp = 'temp',
}

export interface CacheEntryMetadata {
  checksum: string;
  mimeType?: string;
  createdAt: number;
  lastAccessedAt?: number;
  expiresAt?: number;
  sizeBytes?: number;
  namespace?: string;
  metadata?: Record<string, unknown>;
}

export interface CacheSetOptions {
  ttlMs?: number;
  mimeType?: string;
  checksum?: string;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
}

export interface EvictionPolicyOptions {
  maxEntries?: number;
  maxSizeBytes?: number;
  strategy?: 'lru' | 'fifo';
}

export type CachePayload = Blob | ReadableStream<Uint8Array> | ArrayBuffer | ArrayBufferView | string;

export interface IContentCacheStrategy {
  readonly id: ContentCacheStrategyId | string;
  readonly name: string;

  has(key: string): Promise<boolean>;

  /**
   * First-class Web standard Blob retrieval.
   * Backed by zero-copy filesystem, OPFS handles, or IDB Blobs.
   */
  get(key: string): Promise<Blob | null>;

  /**
   * Standardized polymorphic persistence.
   * Directly supports Blob, WHATWG ReadableStream<Uint8Array>, ArrayBuffer, ArrayBufferView, or string.
   */
  set(key: string, data: CachePayload, metadata?: Partial<CacheEntryMetadata>): Promise<void>;

  /**
   * Opens a WHATWG WritableStream directly into storage for zero-copy streaming ingestion.
   */
  createWritableStream?(key: string, metadata?: Partial<CacheEntryMetadata>): Promise<WritableStream<Uint8Array>>;

  /**
   * Metadata retrieval without loading the payload into memory.
   */
  getMetadata(key: string): Promise<CacheEntryMetadata | null>;

  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  getKeys?(): Promise<string[]>;
}

export interface INamespacedCache {
  readonly namespace: string;
  readonly strategyId: string;

  has(key: string): Promise<boolean>;
  get(key: string): Promise<Blob | null>;
  set(key: string, data: CachePayload, options?: CacheSetOptions): Promise<void>;
  createWritableStream?(key: string, options?: CacheSetOptions): Promise<WritableStream<Uint8Array>>;
  getMetadata(key: string): Promise<CacheEntryMetadata | null>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  getKeys(): Promise<string[]>;
  evictExpired(): Promise<number>;
  evict(policy: EvictionPolicyOptions): Promise<number>;
}
