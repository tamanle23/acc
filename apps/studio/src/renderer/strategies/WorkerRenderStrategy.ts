import type { ResolvedTimeline, ResolvedSequence } from '@acc/ir';
import {
  PreviewWorkerBridge,
  type WorkerRenderOptions,
} from '../workers/PreviewWorkerBridge';
import { AssetTextureCache } from '../../lib/textures/AssetTextureCache';
import type { IPreviewRenderStrategy } from './IPreviewRenderStrategy';

export class WorkerRenderStrategy implements IPreviewRenderStrategy {
  public readonly id = 'worker' as const;
  private bridge: PreviewWorkerBridge;
  private width = 1920;
  private height = 1080;
  private fps = 30;
  private totalFrames = 0;
  private timeline: ResolvedTimeline | null = null;
  private assets: Record<string, any> = {};

  constructor(bridge?: PreviewWorkerBridge) {
    this.bridge = bridge || new PreviewWorkerBridge();
  }

  public get isReady(): boolean {
    return this.bridge.getIsReady();
  }

  public init(canvas: HTMLCanvasElement): boolean {
    if (!this.bridge.supportsOffscreen()) {
      return false;
    }
    if (this.bridge.hasTransferred()) {
      return true;
    }

    if (!this.timeline) {
      // Create minimal timeline fallback if not set yet
      this.timeline = {
        meta: { durationFrames: this.totalFrames, fps: this.fps },
        tracks: new Map(),
        sequences: new Map(),
      };
    }

    return this.bridge.init(
      canvas,
      this.timeline,
      this.width,
      this.height,
      this.fps,
      this.totalFrames,
      this.assets
    );
  }

  private syncedSources = new Map<string, any>();

  public updateTimeline(
    timeline: ResolvedTimeline,
    totalFrames: number,
    fps: number,
    assets?: Record<string, any>
  ): void {
    this.timeline = timeline;
    this.totalFrames = totalFrames;
    this.fps = fps;
    if (assets) {
      this.assets = assets;
    }
    this.syncedSources.clear();

    if (this.bridge.hasTransferred()) {
      this.bridge.updateTimeline(timeline, totalFrames, fps, this.assets);
    }
  }

  public async syncTextures(
    activeSeqs: ResolvedSequence[],
    assets: Record<string, any>,
    currentFrame: number,
    fps: number
  ): Promise<void> {
    if (!this.bridge.hasTransferred()) return;
    // Decouple React playback: Worker owns playback frame loop and textures completely
    if (this.bridge.getIsPlaying()) return;

    const studioTextureCache = AssetTextureCache.getInstance();
    const activeTexturesToSync: Record<string, ImageBitmap> = {};
    const syncPromises: Promise<void>[] = [];

    for (const seq of activeSeqs) {
      if (!seq.assetId) continue;

      const assetDef = assets[seq.assetId];
      const assetSrc = assetDef?.src;
      const assetType = assetDef?.type;
      const isVideo =
        assetType === 'video' ||
        Boolean(assetSrc && assetSrc.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i));

      // Video frames are decoded asynchronously inside the worker
      if (isVideo) continue;

      const seqStart = seq.startFrame ?? 0;
      const seqLocalTimeSec = Math.max(0, (currentFrame - seqStart) / (fps || 30));

      const visualAsset = studioTextureCache.getVisualAsset(
        seq.assetId,
        assetSrc,
        (assetType as any) || 'image',
        seqLocalTimeSec
      );

      // Deduplicate: If this asset source is already synchronized to the worker, skip creating a new ImageBitmap
      if (
        visualAsset.source &&
        this.syncedSources.get(seq.assetId) === visualAsset.source
      ) {
        continue;
      }

      if (visualAsset.source && typeof createImageBitmap === 'function') {
        const source = visualAsset.source;
        const assetId = seq.assetId;
        syncPromises.push(
          createImageBitmap(source as ImageBitmapSource)
            .then((bmp) => {
              activeTexturesToSync[assetId] = bmp;
              this.syncedSources.set(assetId, source);
            })
            .catch(() => {})
        );
      }
    }

    if (syncPromises.length > 0) {
      await Promise.all(syncPromises);
      if (Object.keys(activeTexturesToSync).length > 0) {
        this.bridge.updateTextures(activeTexturesToSync);
      }
    }
  }

  public renderFrame(frame: number, options?: WorkerRenderOptions): void {
    if (this.bridge.hasTransferred()) {
      if (this.bridge.getIsPlaying()) return;
      this.bridge.renderFrame(frame, options);
    }
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.bridge.hasTransferred()) {
      this.bridge.resize(width, height);
    }
  }

  public onReady(callback: () => void): void {
    this.bridge.onReady(callback);
  }

  public dispose(): void {
    this.syncedSources.clear();
    this.bridge.destroy();
  }

  public getBridge(): PreviewWorkerBridge {
    return this.bridge;
  }
}
