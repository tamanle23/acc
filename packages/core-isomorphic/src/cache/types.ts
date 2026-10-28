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

export interface IContentCacheStrategy {
  readonly id: ContentCacheStrategyId | string;
  readonly name: string;

  has(key: string): Promise<boolean>;

  /**
   * Standard byte-array retrieval (backward compatibility).
   */
  get(key: string): Promise<Uint8Array | null>;

  /**
   * Standard byte-array persistence (backward compatibility).
   */
  set(key: string, data: Uint8Array, metadata?: Partial<CacheEntryMetadata>): Promise<void>;

  /**
   * Zero-copy / platform-native Blob retrieval.
   * Returns a standard Web Blob directly without holding raw contiguous Uint8Array in JavaScript heap.
   */
  getBlob?(key: string): Promise<Blob | null>;

  /**
   * Zero-copy / platform-native Blob persistence.
   */
  setBlob?(key: string, blob: Blob, metadata?: Partial<CacheEntryMetadata>): Promise<void>;

  /**
   * Streaming API retrieval.
   * Yields a WHATWG ReadableStream<Uint8Array> for chunked non-blocking processing.
   */
  getStream?(key: string): Promise<ReadableStream<Uint8Array> | null>;

  /**
   * Streaming API persistence.
   * Consumes a WHATWG ReadableStream<Uint8Array> directly into storage.
   */
  setStream?(key: string, stream: ReadableStream<Uint8Array>, metadata?: Partial<CacheEntryMetadata>): Promise<void>;

  /**
   * Metadata retrieval without loading the payload into memory.
   */
  getMetadata?(key: string): Promise<CacheEntryMetadata | null>;

  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  getKeys?(): Promise<string[]>;
}

