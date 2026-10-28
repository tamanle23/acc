import type { IAssetBlob } from './IAssetBlob';
import { ContentCacheRegistry } from '../cache/ContentCacheRegistry';

function getMimeTypeFromExtension(ext: string): string {
  const cleanExt = ext.replace(/^\./, '').toLowerCase();
  switch (cleanExt) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mov':
      return 'video/quicktime';
    case 'mkv':
      return 'video/x-matroska';
    case 'wav':
      return 'audio/wav';
    case 'mp3':
      return 'audio/mpeg';
    case 'ogg':
      return 'audio/ogg';
    case 'aac':
      return 'audio/aac';
    case 'm4a':
      return 'audio/mp4';
    case 'flac':
      return 'audio/flac';
    case 'json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

export class FileAssetBlob implements IAssetBlob {
  public readonly uri: string;
  public readonly mimeType: string;
  private filePath: string;

  constructor(filePath: string, uri?: string, mimeType?: string) {
    this.filePath = filePath;
    this.uri = uri || `file://${filePath}`;
    const dotIdx = filePath.lastIndexOf('.');
    const ext = dotIdx !== -1 ? filePath.substring(dotIdx) : '';
    this.mimeType = mimeType || getMimeTypeFromExtension(ext);
  }

  public getNativePath(): string | null {
    return this.filePath;
  }

  public stream(): ReadableStream<Uint8Array> {
    if (typeof (globalThis as any).Bun !== 'undefined' && typeof (globalThis as any).Bun.file === 'function') {
      return (globalThis as any).Bun.file(this.filePath).stream();
    }
    // Node.js fallback
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = require('fs');
      const nodeStream = fs.createReadStream(this.filePath);
      return new ReadableStream<Uint8Array>({
        start(controller) {
          nodeStream.on('data', (chunk: any) => {
            controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
          });
          nodeStream.on('end', () => controller.close());
          nodeStream.on('error', (err: any) => controller.error(err));
        },
        cancel() {
          nodeStream.destroy();
        },
      });
    }
    throw new Error(`[FileAssetBlob] Local file access is not supported in this runtime environment.`);
  }

  public async arrayBuffer(): Promise<ArrayBuffer> {
    if (typeof (globalThis as any).Bun !== 'undefined' && typeof (globalThis as any).Bun.file === 'function') {
      return (globalThis as any).Bun.file(this.filePath).arrayBuffer();
    }
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = require('fs');
      const buf = await fs.promises.readFile(this.filePath);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
    throw new Error(`[FileAssetBlob] Local file reading is not supported in this runtime environment.`);
  }

  public async blob(): Promise<Blob> {
    if (typeof (globalThis as any).Bun !== 'undefined' && typeof (globalThis as any).Bun.file === 'function') {
      return (globalThis as any).Bun.file(this.filePath);
    }
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = require('fs');
      if (typeof fs.openAsBlob === 'function') {
        return fs.openAsBlob(this.filePath, { type: this.mimeType });
      }
    }
    const buf = await this.arrayBuffer();
    return new Blob([buf], { type: this.mimeType });
  }
}

export class HttpAssetBlob implements IAssetBlob {
  public readonly uri: string;
  public readonly mimeType: string;

  constructor(uri: string, mimeType?: string) {
    this.uri = uri;
    const dotIdx = uri.lastIndexOf('.');
    const ext = dotIdx !== -1 ? uri.substring(dotIdx).split('?')[0] : '';
    this.mimeType = mimeType || getMimeTypeFromExtension(ext);
  }

  public getNativePath(): string | null {
    return null;
  }

  public stream(): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        try {
          const res = await fetch(this.uri);
          if (!res.ok || !res.body) {
            throw new Error(`HTTP fetch failed with status ${res.status}: ${this.uri}`);
          }
          const reader = res.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) controller.enqueue(value);
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
  }

  public async arrayBuffer(): Promise<ArrayBuffer> {
    const res = await fetch(this.uri);
    if (!res.ok) {
      throw new Error(`HTTP fetch failed with status ${res.status}: ${this.uri}`);
    }
    return res.arrayBuffer();
  }

  public async blob(): Promise<Blob> {
    const res = await fetch(this.uri);
    if (!res.ok) {
      throw new Error(`HTTP fetch failed with status ${res.status}: ${this.uri}`);
    }
    return res.blob();
  }
}

export class BlobAssetBlob implements IAssetBlob {
  public readonly uri: string;
  public readonly mimeType: string;
  public readonly size?: number;
  private blobInstance?: Blob;

  constructor(uri: string, blob?: Blob, mimeType?: string) {
    this.uri = uri;
    this.blobInstance = blob;
    this.mimeType = mimeType || blob?.type || 'application/octet-stream';
    this.size = blob?.size;
  }

  public getNativePath(): string | null {
    return null;
  }

  public stream(): ReadableStream<Uint8Array> {
    if (this.blobInstance && typeof this.blobInstance.stream === 'function') {
      return this.blobInstance.stream();
    }
    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        try {
          const res = await fetch(this.uri);
          if (!res.ok || !res.body) {
            throw new Error(`Failed to stream blob URL ${this.uri}`);
          }
          const reader = res.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) controller.enqueue(value);
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
  }

  public async arrayBuffer(): Promise<ArrayBuffer> {
    if (this.blobInstance) {
      return this.blobInstance.arrayBuffer();
    }
    const res = await fetch(this.uri);
    return res.arrayBuffer();
  }

  public async blob(): Promise<Blob> {
    if (this.blobInstance) {
      return this.blobInstance;
    }
    const res = await fetch(this.uri);
    return res.blob();
  }
}

export class DataUriAssetBlob implements IAssetBlob {
  public readonly uri: string;
  public readonly mimeType: string;
  private binaryData: Uint8Array;

  constructor(uri: string) {
    this.uri = uri;
    const match = uri.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error(`[DataUriAssetBlob] Malformed data URI: ${uri.slice(0, 30)}...`);
    }
    this.mimeType = match[1];
    const base64 = match[2];
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
      const buf = Buffer.from(base64, 'base64');
      this.binaryData = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } else {
      const binaryStr = atob(base64);
      this.binaryData = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        this.binaryData[i] = binaryStr.charCodeAt(i);
      }
    }
  }

  public getNativePath(): string | null {
    return null;
  }

  public stream(): ReadableStream<Uint8Array> {
    const data = this.binaryData;
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
  }

  public async arrayBuffer(): Promise<ArrayBuffer> {
    return this.binaryData.buffer.slice(
      this.binaryData.byteOffset,
      this.binaryData.byteOffset + this.binaryData.byteLength
    );
  }

  public async blob(): Promise<Blob> {
    return new Blob([this.binaryData], { type: this.mimeType });
  }
}

export class CachedAssetBlob implements IAssetBlob {
  public readonly uri: string;
  public readonly mimeType: string;
  private cacheKey: string;
  private strategyId?: string;

  constructor(uri: string, cacheKey: string, strategyId?: string, mimeType?: string) {
    this.uri = uri;
    this.cacheKey = cacheKey;
    this.strategyId = strategyId;
    this.mimeType = mimeType || 'application/octet-stream';
  }

  public getNativePath(): string | null {
    return null;
  }

  public stream(): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        try {
          const strategy = ContentCacheRegistry.get(this.strategyId);
          if (strategy.getStream) {
            const stream = await strategy.getStream(this.cacheKey);
            if (!stream) throw new Error(`[CachedAssetBlob] Key "${this.cacheKey}" not found in cache.`);
            const reader = stream.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) controller.enqueue(value);
            }
            controller.close();
            return;
          }
          const bytes = await strategy.get(this.cacheKey);
          if (!bytes) throw new Error(`[CachedAssetBlob] Key "${this.cacheKey}" not found in cache.`);
          controller.enqueue(bytes);
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
  }

  public async arrayBuffer(): Promise<ArrayBuffer> {
    const strategy = ContentCacheRegistry.get(this.strategyId);
    const bytes = await strategy.get(this.cacheKey);
    if (!bytes) {
      throw new Error(`[CachedAssetBlob] Key "${this.cacheKey}" not found in cache.`);
    }
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }

  public async blob(): Promise<Blob> {
    const strategy = ContentCacheRegistry.get(this.strategyId);
    if (strategy.getBlob) {
      const blob = await strategy.getBlob(this.cacheKey);
      if (blob) return blob;
    }
    const bytes = await strategy.get(this.cacheKey);
    if (!bytes) {
      throw new Error(`[CachedAssetBlob] Key "${this.cacheKey}" not found in cache.`);
    }
    return new Blob([bytes], { type: this.mimeType });
  }
}

export class AssetProtocolRegistry {
  private static instance: AssetProtocolRegistry;
  private customProtocols = new Map<string, (uri: string, baseDir?: string) => IAssetBlob>();

  public static getInstance(): AssetProtocolRegistry {
    if (!AssetProtocolRegistry.instance) {
      AssetProtocolRegistry.instance = new AssetProtocolRegistry();
    }
    return AssetProtocolRegistry.instance;
  }

  public registerProtocol(protocol: string, handler: (uri: string, baseDir?: string) => IAssetBlob): void {
    const cleanProto = protocol.replace(/:$/, '').toLowerCase();
    this.customProtocols.set(cleanProto, handler);
  }

  public resolve(uri: string, baseDir?: string): IAssetBlob {
    if (!uri) {
      throw new Error('[AssetProtocolRegistry] Cannot resolve empty URI');
    }

    // Check custom registered protocols
    const colonIdx = uri.indexOf(':');
    if (colonIdx > 0) {
      const proto = uri.substring(0, colonIdx).toLowerCase();
      const customHandler = this.customProtocols.get(proto);
      if (customHandler) {
        return customHandler(uri, baseDir);
      }
    }

    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return new HttpAssetBlob(uri);
    }

    if (uri.startsWith('blob:')) {
      return new BlobAssetBlob(uri);
    }

    if (uri.startsWith('data:')) {
      return new DataUriAssetBlob(uri);
    }

    if (uri.startsWith('cache:')) {
      // Formats: cache://key or cache:key
      const cacheKey = uri.replace(/^cache:\/\/|^cache:/, '');
      return new CachedAssetBlob(uri, cacheKey);
    }

    let filePath = uri;
    if (filePath.startsWith('file://')) {
      filePath = filePath.slice(7);
    }

    // Resolve relative path if baseDir provided and not absolute
    if (baseDir && !filePath.startsWith('/') && !filePath.match(/^[a-zA-Z]:\\/)) {
      if (typeof process !== 'undefined' && process.versions?.node) {
        const path = require('path');
        filePath = path.resolve(baseDir, filePath);
      } else {
        const trimmedBase = baseDir.endsWith('/') ? baseDir : `${baseDir}/`;
        filePath = `${trimmedBase}${filePath}`;
      }
    }

    return new FileAssetBlob(filePath, uri);
  }
}
