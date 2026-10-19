/**
 * Universal Streaming Asset Blob interface.
 * Abstracts media resources across Web (browsers/web workers) and Node/Bun runtimes
 * without in-memory byte buffer bloat or V8 heap exhaustion.
 */
export interface IAssetBlob {
  readonly uri: string;
  readonly mimeType: string;
  readonly size?: number;
  stream(): ReadableStream<Uint8Array>;
  arrayBuffer(): Promise<ArrayBuffer>;
  getNativePath?(): string | null;
}
