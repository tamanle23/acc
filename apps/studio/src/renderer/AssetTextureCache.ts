import {
  AssetTextureCache as AuthoritativeAssetTextureCache,
  type VisualAssetResult,
} from '../lib/textures/AssetTextureCache';

/**
 * AssetTextureCache Adapter (apps/studio/src/renderer/AssetTextureCache.ts)
 *
 * Backward-compatible bridge delegating to the authoritative singleton in
 * `apps/studio/src/lib/textures/AssetTextureCache.ts`.
 *
 * Supports both:
 * - Direct constructor invocation: `new AssetTextureCache()`
 * - Singleton retrieval: `AssetTextureCache.getInstance()`
 *
 * Sharing the exact same underlying cache map and resource pool across
 * preview rendering, timeline thumbnails, and tests.
 */
export class AssetTextureCache {
  private static directStorage = new Map<string, any>();
  private static objectUrls = new Map<string, string>();

  /**
   * Returns the authoritative singleton instance.
   */
  public static getInstance(): AuthoritativeAssetTextureCache {
    return AuthoritativeAssetTextureCache.getInstance();
  }

  /**
   * Register or cache a visual texture directly.
   */
  public set(assetId: string, texture: any): void {
    AssetTextureCache.directStorage.set(assetId, texture);
  }

  /**
   * Retrieve a cached texture by asset ID.
   */
  public get(assetId: string): any | undefined {
    return AssetTextureCache.directStorage.get(assetId);
  }

  /**
   * Check if an asset is cached.
   */
  public has(assetId: string): boolean {
    return AssetTextureCache.directStorage.has(assetId);
  }

  /**
   * Delete a cached texture by asset ID.
   */
  public delete(assetId: string): boolean {
    const url = AssetTextureCache.objectUrls.get(assetId);
    if (url && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      URL.revokeObjectURL(url);
      AssetTextureCache.objectUrls.delete(assetId);
    }
    return AssetTextureCache.directStorage.delete(assetId);
  }

  /**
   * Load an image texture from a Blob or URL string.
   */
  public async loadBlob(assetId: string, blob: Blob): Promise<any> {
    if (
      typeof window === 'undefined' ||
      typeof URL === 'undefined' ||
      typeof Image === 'undefined'
    ) {
      // Headless / non-DOM mock
      const mockImg = { width: 1920, height: 1080, _isMock: true };
      AssetTextureCache.directStorage.set(assetId, mockImg);
      return mockImg;
    }

    const objectUrl = URL.createObjectURL(blob);
    AssetTextureCache.objectUrls.set(assetId, objectUrl);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        AssetTextureCache.directStorage.set(assetId, img);
        resolve(img);
      };
      img.onerror = (e) => {
        reject(new Error(`Failed to load texture blob for ${assetId}: ${e}`));
      };
      img.src = objectUrl;
    });
  }

  /**
   * Clears all cached textures and revokes object URLs.
   */
  public clear(): void {
    this.dispose();
  }

  /**
   * Disposes of object URLs to prevent memory leaks in long-running sessions.
   */
  public dispose(): void {
    if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
      for (const url of AssetTextureCache.objectUrls.values()) {
        URL.revokeObjectURL(url);
      }
    }
    AssetTextureCache.objectUrls.clear();
    AssetTextureCache.directStorage.clear();
  }

  // Authoritative delegation helpers:
  public getVisualAsset(
    assetId: string,
    src?: string,
    assetType: 'image' | 'video' = 'image',
    timeSec: number = 0
  ): VisualAssetResult {
    return AuthoritativeAssetTextureCache.getInstance().getVisualAsset(
      assetId,
      src,
      assetType,
      timeSec
    );
  }

  public subscribe(callback: () => void): () => void {
    return AuthoritativeAssetTextureCache.getInstance().subscribe(callback);
  }
}

export type { VisualAssetResult };
