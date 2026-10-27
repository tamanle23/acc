/**
 * AssetTextureCache:
 * Resource Manager & Object Pool for preview visual textures.
 * In browser environments, maps Blobs via URL.createObjectURL with safe revocation on eviction/dispose.
 * Provides safe fallback for headless SSR/Node/Bun environments.
 */
export class AssetTextureCache {
  private textures = new Map<string, any>();
  private objectUrls = new Map<string, string>();

  /**
   * Register or cache a visual texture directly.
   */
  public set(assetId: string, texture: any): void {
    this.textures.set(assetId, texture);
  }

  /**
   * Retrieve a cached texture by asset ID.
   */
  public get(assetId: string): any | undefined {
    return this.textures.get(assetId);
  }

  /**
   * Check if an asset is cached.
   */
  public has(assetId: string): boolean {
    return this.textures.has(assetId);
  }

  /**
   * Delete a cached texture by asset ID.
   */
  public delete(assetId: string): boolean {
    const url = this.objectUrls.get(assetId);
    if (url && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      URL.revokeObjectURL(url);
      this.objectUrls.delete(assetId);
    }
    return this.textures.delete(assetId);
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
      this.textures.set(assetId, mockImg);
      return mockImg;
    }

    const objectUrl = URL.createObjectURL(blob);
    this.objectUrls.set(assetId, objectUrl);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.textures.set(assetId, img);
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
      for (const url of this.objectUrls.values()) {
        URL.revokeObjectURL(url);
      }
    }
    this.objectUrls.clear();
    this.textures.clear();
  }
}
