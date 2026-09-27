import { Logger } from './logger';

export class AssetContext {
  private assets: Map<string, Map<string, string>> = new Map();

  /**
   * Registers a modified asset.
   * @param sceneId The unique ID of the scene (e.g., 'scene_1')
   * @param variant The type of variant (e.g., 'original', 'upscaled', 'depth')
   * @param path The absolute path to the generated asset
   */
  public register(sceneId: string, variant: string, path: string): void {
    if (!this.assets.has(sceneId)) {
      this.assets.set(sceneId, new Map());
    }
    this.assets.get(sceneId)!.set(variant, path);
    Logger.debug('AssetContext', `Registered asset [${sceneId}] (${variant}): ${path}`);
  }

  /**
   * Retrieves the preferred asset variant if it exists, otherwise falls back.
   * @param sceneId The unique ID of the scene
   * @param preferredVariants Ordered array of preferred variants (e.g., ['upscaled', 'original'])
   * @returns The path to the best available asset, or undefined if none exist
   */
  public getPreferred(sceneId: string, preferredVariants: string[]): string | undefined {
    const sceneAssets = this.assets.get(sceneId);
    if (!sceneAssets) return undefined;

    for (const variant of preferredVariants) {
      if (sceneAssets.has(variant)) {
        return sceneAssets.get(variant);
      }
    }
    return undefined;
  }
}
