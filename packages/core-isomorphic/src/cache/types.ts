/**
 * Universal Isomorphic Content Cache Strategy Types
 */

export enum ContentCacheStrategyId {
  NativeFile = 'native-file',
  IndexedDb = 'indexeddb',
  WebCache = 'web-cache',
  Opfs = 'opfs',
}

export interface CacheEntryMetadata {
  checksum: string;
  mimeType?: string;
  createdAt: number;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
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

