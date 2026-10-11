import path from 'path';
import type {
  IMediaAssetProberHandler,
  DiscoveredAssetManifest,
  ProberScanOptions,
} from '../types';

export abstract class BaseMediaAssetProberHandler implements IMediaAssetProberHandler {
  public abstract readonly id: string;
  public abstract readonly name: string;
  private nextHandler: IMediaAssetProberHandler | null = null;

  public setNext(handler: IMediaAssetProberHandler): IMediaAssetProberHandler {
    this.nextHandler = handler;
    return handler;
  }

  public async handle(
    filePath: string,
    baseDir: string,
    manifest: DiscoveredAssetManifest,
    options?: ProberScanOptions
  ): Promise<boolean> {
    const handled = await this.canHandle(filePath)
      ? await this.processFile(filePath, baseDir, manifest, options)
      : false;

    if (!handled && this.nextHandler) {
      return this.nextHandler.handle(filePath, baseDir, manifest, options);
    }

    return handled;
  }

  protected abstract canHandle(filePath: string): boolean | Promise<boolean>;

  protected abstract processFile(
    filePath: string,
    baseDir: string,
    manifest: DiscoveredAssetManifest,
    options?: ProberScanOptions
  ): Promise<boolean>;

  protected getRelativePath(filePath: string, baseDir: string): string {
    return path.relative(baseDir, filePath).replace(/\\/g, '/');
  }

  protected getBaseName(filePath: string): string {
    return path.parse(filePath).name;
  }

  protected getExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase();
  }
}
