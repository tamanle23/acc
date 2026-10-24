import { ContentCacheRegistry } from '../cache/ContentCacheRegistry';
import { UniversalLogger as Logger } from '../logger/UniversalLogger';

export interface OnnxModelMetadata {
  modelId: string;
  sourceUrl?: string;
  format?: 'onnx' | 'ort';
  sizeBytes?: number;
  checksum?: string;
}

/**
 * OnnxModelManager:
 * Pure isomorphic model manager and storage interface for ONNX runtime models.
 * Decouples model resolution from host execution environment:
 * - On Node/Bun: resolves or persists model weights via ContentCacheRegistry (e.g. NativeFileCacheStrategy).
 * - On Web: resolves or persists model weights via ContentCacheRegistry (e.g. IndexedDbCacheStrategy or URL fetch).
 *
 * Adheres strictly to OS-COMPAT, STATE-IMMUTABILITY, and DEFENSIVE-CODING.
 */
export class OnnxModelManager {
  private static instance: OnnxModelManager | null = null;
  private registeredModels = new Map<string, OnnxModelMetadata>();

  private constructor() {
    this.registerDefaultModels();
  }

  public static getInstance(): OnnxModelManager {
    if (!OnnxModelManager.instance) {
      OnnxModelManager.instance = new OnnxModelManager();
    }
    return OnnxModelManager.instance;
  }

  private registerDefaultModels(): void {
    this.registerModel({
      modelId: 'briaai/RMBG-1.4',
      format: 'onnx',
    });
    this.registerModel({
      modelId: 'depth-anything/Depth-Anything-V2-Small-hf',
      format: 'onnx',
    });
    this.registerModel({
      modelId: 'depth-anything/Depth-Anything-V2-Base-hf',
      format: 'onnx',
    });
    this.registerModel({
      modelId: 'facebook/sam2-hiera-tiny',
      format: 'onnx',
    });
    this.registerModel({
      modelId: 'nomic-ai/nomic-embed-text-v1.5',
      format: 'onnx',
    });
  }

  public registerModel(meta: OnnxModelMetadata): void {
    this.registeredModels.set(meta.modelId, meta);
  }

  public getModelMetadata(modelId: string): OnnxModelMetadata | undefined {
    return this.registeredModels.get(modelId);
  }

  public hasModelMetadata(modelId: string): boolean {
    return this.registeredModels.has(modelId);
  }

  /**
   * Retrieves model bytes from the configured ContentCacheRegistry.
   * Returns undefined if cache miss.
   */
  public async getCachedModelBuffer(modelKey: string): Promise<Uint8Array | undefined> {
    try {
      const cache = ContentCacheRegistry.get();
      const cacheKey = `onnx_model_${modelKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      if (await cache.has(cacheKey)) {
        return (await cache.get(cacheKey)) || undefined;
      }
    } catch (err: any) {
      Logger.warn('OnnxModelManager', `Cache lookup failed for ${modelKey}: ${err.message}`);
    }
    return undefined;
  }

  /**
   * Stores model bytes into the configured ContentCacheRegistry.
   */
  public async storeModelBuffer(
    modelKey: string,
    buffer: Uint8Array,
    mimeType = 'application/octet-stream'
  ): Promise<void> {
    try {
      const cache = ContentCacheRegistry.get();
      const cacheKey = `onnx_model_${modelKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      await cache.set(cacheKey, buffer, { mimeType });
    } catch (err: any) {
      Logger.warn('OnnxModelManager', `Failed to store model in cache for ${modelKey}: ${err.message}`);
    }
  }

  /**
   * Universal resolution of model buffer: checks ContentCacheRegistry first,
   * otherwise fetches from remote URL / source and caches it.
   */
  public async resolveModelBuffer(modelId: string, fallbackUrl?: string): Promise<Uint8Array | null> {
    const cached = await this.getCachedModelBuffer(modelId);
    if (cached) {
      return cached;
    }

    const url = fallbackUrl || this.registeredModels.get(modelId)?.sourceUrl;
    if (url) {
      try {
        Logger.info('OnnxModelManager', `Downloading model [${modelId}] from ${url}...`);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
        const ab = await res.arrayBuffer();
        const bytes = new Uint8Array(ab);
        await this.storeModelBuffer(modelId, bytes);
        return bytes;
      } catch (err: any) {
        Logger.warn('OnnxModelManager', `Failed to fetch model [${modelId}]: ${err.message}`);
      }
    }

    return null;
  }
}
