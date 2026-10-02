export interface AssetPathPair {
  originalPath: string;
  proxyPath?: string;
}

export class ProxyAssetManager {
  private registry: Map<string, AssetPathPair> = new Map();
  private useProxies = false;

  public setProxyMode(enabled: boolean): void {
    this.useProxies = enabled;
  }

  public registerAsset(assetId: string, originalPath: string, proxyPath?: string): void {
    this.registry.set(assetId, { originalPath, proxyPath });
  }

  public getResolvedPath(assetId: string): string {
    const pair = this.registry.get(assetId);
    if (!pair) return assetId; // Fallback to raw string if unregistered

    if (this.useProxies && pair.proxyPath) {
      return pair.proxyPath;
    }
    return pair.originalPath;
  }
}
