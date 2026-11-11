// ============================================================================
// KINETIX STUDIO - DRIVEN PORT: STORAGE PORT (ECMA-429)
// Pure architectural interface decoupling browser persistence (OPFS,
// IndexedDB, LocalStorage, Memory) from studio session & preset management.
// ============================================================================

export interface IStorageRepositoryPort {
  getItem<T = unknown>(key: string): Promise<T | null>;
  setItem<T = unknown>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  hasItem(key: string): Promise<boolean>;
}
