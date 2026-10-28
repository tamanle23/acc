import {
  ContentCacheStrategyId,
  type IContentCacheStrategy,
  type CachePayload,
  type CacheEntryMetadata,
  fastChecksum,
  payloadToBlob,
  payloadToStream,
} from '@acc/core-isomorphic';
import { IndexedDbCacheStrategy } from './IndexedDbCacheStrategy';

const DEFAULT_OPFS_DIRECTORY = 'acc_content_cache';

export interface OpfsCacheOptions {
  directoryName?: string;
  fallbackStrategy?: IContentCacheStrategy;
}

export interface OpfsEntryInfo {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  sizeBytes: number;
  lastModified: number;
  mimeType: string;
  isMetadata: boolean;
  decodedKey?: string;
  metadata?: CacheEntryMetadata | null;
}

export interface OpfsTreeNode {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  sizeBytes: number;
  lastModified: number;
  mimeType: string;
  isMetadata: boolean;
  decodedKey?: string;
  metadata?: CacheEntryMetadata | null;
  children?: OpfsTreeNode[];
}

export interface OpfsStorageEstimate {
  usage: number;
  quota: number;
  usagePercent: number;
  formattedUsage: string;
  formattedQuota: string;
}

export function formatOpfsBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
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

  public async get(key: string): Promise<Blob | null> {
    const dir = await this.getDirectory();
    if (!dir) {
      return this.fallback.get(key);
    }

    const safeName = this.sanitizeKey(key);
    try {
      const handle = await dir.getFileHandle(safeName);
      return await handle.getFile();
    } catch {
      return null;
    }
  }

  public async set(
    key: string,
    data: CachePayload,
    metadata?: Partial<CacheEntryMetadata>
  ): Promise<void> {
    const dir = await this.getDirectory();
    if (!dir) {
      return this.fallback.set(key, data, metadata);
    }

    const safeName = this.sanitizeKey(key);
    const blob = await payloadToBlob(data, metadata?.mimeType);
    const handle = await dir.getFileHandle(safeName, { create: true });
    const writable = await handle.createWritable();
    try {
      await blob.stream().pipeTo(writable);
    } finally {
      try {
        await writable.close();
      } catch {}
    }

    // Persist companion metadata
    const meta: CacheEntryMetadata = {
      checksum: metadata?.checksum || `opfs-blob-${Date.now()}`,
      mimeType: metadata?.mimeType || blob.type || 'application/octet-stream',
      createdAt: metadata?.createdAt || Date.now(),
      sizeBytes: metadata?.sizeBytes ?? blob.size,
      metadata: metadata?.metadata,
    };
    await this.writeMetadata(dir, safeName, meta);
  }

  public async createWritableStream(
    key: string,
    metadata?: Partial<CacheEntryMetadata>
  ): Promise<WritableStream<Uint8Array>> {
    const dir = await this.getDirectory();
    if (!dir) {
      if (typeof this.fallback.createWritableStream === 'function') {
        return this.fallback.createWritableStream(key, metadata);
      }
      throw new Error('[OpfsCacheStrategy] OPFS unavailable and fallback has no createWritableStream');
    }

    const safeName = this.sanitizeKey(key);
    const handle = await dir.getFileHandle(safeName, { create: true });
    const writable = await handle.createWritable();
    let totalBytes = 0;

    return new WritableStream<Uint8Array>({
      async write(chunk) {
        totalBytes += chunk.byteLength;
        await writable.write(chunk as unknown as ArrayBufferView);
      },
      async close() {
        await writable.close();
        const meta: CacheEntryMetadata = {
          checksum: metadata?.checksum || `opfs-stream-${Date.now()}_${totalBytes}`,
          mimeType: metadata?.mimeType || 'application/octet-stream',
          createdAt: metadata?.createdAt || Date.now(),
          sizeBytes: metadata?.sizeBytes ?? totalBytes,
          metadata: metadata?.metadata,
        };
        await this.writeMetadata(dir, safeName, meta);
      },
      async abort(reason) {
        await writable.abort(reason);
      },
    });
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
            try {
              keys.push(decodeURIComponent(entry.name.replace(/_/g, '%')));
            } catch {
              keys.push(entry.name);
            }
          }
        }
      }
    } catch {}

    return keys;
  }

  public getDirectoryName(): string {
    return this.directoryName;
  }

  public async getDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
    return this.getDirectory();
  }

  public async getRootDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.isSupported()) return null;
    try {
      return await navigator.storage.getDirectory();
    } catch {
      return null;
    }
  }

  public async getStorageEstimate(): Promise<OpfsStorageEstimate | null> {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
      return null;
    }
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;
      return {
        usage,
        quota,
        usagePercent,
        formattedUsage: formatOpfsBytes(usage),
        formattedQuota: formatOpfsBytes(quota),
      };
    } catch {
      return null;
    }
  }

  /**
   * Recursively traverses and returns a hierarchical tree of files and subdirectories.
   */
  public async inspectTree(
    targetDirHandle?: FileSystemDirectoryHandle | null,
    basePath?: string
  ): Promise<OpfsTreeNode> {
    const dir = targetDirHandle || (await this.getDirectory());
    const dirName = targetDirHandle ? targetDirHandle.name : this.directoryName;
    const currentPath = basePath ? `${basePath}/${dirName}` : dirName;

    if (!dir) {
      return {
        name: dirName,
        path: currentPath,
        kind: 'directory',
        sizeBytes: 0,
        lastModified: Date.now(),
        mimeType: 'inode/directory',
        isMetadata: false,
        children: [],
      };
    }

    const children: OpfsTreeNode[] = [];
    let totalSizeBytes = 0;
    let latestModified = 0;

    try {
      // Gather handles via entries() or values()
      const entries: FileSystemHandle[] = [];
      const anyDir = dir as any;
      if (typeof anyDir.values === 'function') {
        for await (const handle of anyDir.values()) {
          entries.push(handle);
        }
      } else if (typeof anyDir.entries === 'function') {
        for await (const [, handle] of anyDir.entries()) {
          entries.push(handle);
        }
      }

      // First pass: extract any .meta.json files into lookup map
      const metaLookup = new Map<string, CacheEntryMetadata>();
      for (const handle of entries) {
        if (handle.kind === 'file' && handle.name.endsWith('.meta.json')) {
          try {
            const file = await (handle as FileSystemFileHandle).getFile();
            const text = await file.text();
            const meta = JSON.parse(text) as CacheEntryMetadata;
            const targetBaseName = handle.name.replace(/\.meta\.json$/, '');
            metaLookup.set(targetBaseName, meta);
          } catch {}
        }
      }

      // Second pass: build node objects
      for (const handle of entries) {
        const itemPath = `${currentPath}/${handle.name}`;
        if (handle.kind === 'directory') {
          const subTree = await this.inspectTree(handle as FileSystemDirectoryHandle, currentPath);
          children.push(subTree);
          totalSizeBytes += subTree.sizeBytes;
          if (subTree.lastModified > latestModified) {
            latestModified = subTree.lastModified;
          }
        } else {
          try {
            const file = await (handle as FileSystemFileHandle).getFile();
            const isMeta = handle.name.endsWith('.meta.json');
            const safeBaseName = isMeta ? handle.name.replace(/\.meta\.json$/, '') : handle.name;
            let decodedKey: string | undefined;
            if (!isMeta) {
              try {
                decodedKey = decodeURIComponent(safeBaseName.replace(/_/g, '%'));
              } catch {
                decodedKey = safeBaseName;
              }
            }
            const metadata = !isMeta ? metaLookup.get(safeBaseName) || null : null;

            totalSizeBytes += file.size;
            if (file.lastModified > latestModified) {
              latestModified = file.lastModified;
            }

            children.push({
              name: handle.name,
              path: itemPath,
              kind: 'file',
              sizeBytes: file.size,
              lastModified: file.lastModified,
              mimeType: file.type || (isMeta ? 'application/json' : metadata?.mimeType || 'application/octet-stream'),
              isMetadata: isMeta,
              decodedKey,
              metadata,
            });
          } catch {}
        }
      }
    } catch {}

    // Sort children: directories first, then alphabetical
    children.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      name: dirName,
      path: currentPath,
      kind: 'directory',
      sizeBytes: totalSizeBytes,
      lastModified: latestModified || Date.now(),
      mimeType: 'inode/directory',
      isMetadata: false,
      children,
    };
  }

  /**
   * Returns a flattened list of all entries in the OPFS cache directory.
   */
  public async inspectEntries(includeMeta: boolean = true): Promise<OpfsEntryInfo[]> {
    const tree = await this.inspectTree();
    const result: OpfsEntryInfo[] = [];

    function traverse(node: OpfsTreeNode) {
      if (node.kind === 'file') {
        if (includeMeta || !node.isMetadata) {
          result.push({
            name: node.name,
            path: node.path,
            kind: 'file',
            sizeBytes: node.sizeBytes,
            lastModified: node.lastModified,
            mimeType: node.mimeType,
            isMetadata: node.isMetadata,
            decodedKey: node.decodedKey,
            metadata: node.metadata,
          });
        }
      } else if (node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    }

    if (tree.children) {
      for (const child of tree.children) {
        traverse(child);
      }
    }

    return result;
  }

  /**
   * Directly reads a file in the OPFS cache directory as a Web Blob.
   */
  public async readEntryBlob(pathOrName: string): Promise<Blob | null> {
    const dir = await this.getDirectory();
    if (!dir) return null;

    const fileName = pathOrName.split('/').pop() || pathOrName;
    try {
      const handle = await dir.getFileHandle(fileName);
      return await handle.getFile();
    } catch {
      return null;
    }
  }

  /**
   * Directly reads a file in the OPFS cache directory as UTF-8 text.
   */
  public async readEntryText(pathOrName: string): Promise<string | null> {
    const blob = await this.readEntryBlob(pathOrName);
    if (!blob) return null;
    return await blob.text();
  }

  /**
   * Writes a custom file directly into the OPFS directory.
   */
  public async writeCustomFile(
    fileName: string,
    data: CachePayload,
    mimeType?: string
  ): Promise<void> {
    const dir = await this.getDirectory();
    if (!dir) {
      throw new Error('[OpfsCacheStrategy] OPFS directory unavailable');
    }

    const cleanName = fileName.split('/').pop() || fileName;
    const blob = await payloadToBlob(data, mimeType);
    const handle = await dir.getFileHandle(cleanName, { create: true });
    const writable = await handle.createWritable();
    try {
      if (
        (typeof WritableStream !== 'undefined' && writable instanceof WritableStream) ||
        typeof (writable as any).getWriter === 'function'
      ) {
        await blob.stream().pipeTo(writable);
      } else {
        const buffer = await blob.arrayBuffer();
        if (typeof (writable as any).write === 'function') {
          await (writable as any).write(new Uint8Array(buffer));
        }
      }
    } finally {
      try {
        await (writable as any).close();
      } catch {}
    }
  }

  /**
   * Removes a file or directory entry by name.
   */
  public async removeCustomEntry(fileName: string, isDirectory: boolean = false): Promise<boolean> {
    const dir = await this.getDirectory();
    if (!dir) return false;

    const cleanName = fileName.split('/').pop() || fileName;
    try {
      await dir.removeEntry(cleanName, { recursive: isDirectory });
      // If there's companion metadata, remove it as well
      if (!isDirectory && !cleanName.endsWith('.meta.json')) {
        try {
          await dir.removeEntry(`${cleanName}.meta.json`);
        } catch {}
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Creates a sub-directory in the OPFS directory.
   */
  public async createCustomDirectory(dirName: string): Promise<boolean> {
    const dir = await this.getDirectory();
    if (!dir) return false;

    const cleanName = dirName.split('/').pop() || dirName;
    try {
      await dir.getDirectoryHandle(cleanName, { create: true });
      return true;
    } catch {
      return false;
    }
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
