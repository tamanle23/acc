import type { IAssetBlob } from './IAssetBlob';

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
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mov':
      return 'video/quicktime';
    case 'wav':
      return 'audio/wav';
    case 'mp3':
      return 'audio/mpeg';
    case 'aac':
      return 'audio/aac';
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
          nodeStream.on('data', (chunk: Buffer) => {
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
    let controllerRef: ReadableStreamDefaultController<Uint8Array>;
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        controllerRef = controller;
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
}

export class AssetProtocolRegistry {
  private static instance: AssetProtocolRegistry;

  public static getInstance(): AssetProtocolRegistry {
    if (!AssetProtocolRegistry.instance) {
      AssetProtocolRegistry.instance = new AssetProtocolRegistry();
    }
    return AssetProtocolRegistry.instance;
  }

  public resolve(uri: string, baseDir?: string): IAssetBlob {
    if (!uri) {
      throw new Error('[AssetProtocolRegistry] Cannot resolve empty URI');
    }

    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return new HttpAssetBlob(uri);
    }

    if (uri.startsWith('data:')) {
      return new DataUriAssetBlob(uri);
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
