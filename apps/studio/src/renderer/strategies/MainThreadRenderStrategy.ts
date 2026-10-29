import type { ResolvedTimeline, ResolvedSequence } from '@acc/ir';
import { IRPreviewEngine } from '../IRPreviewEngine';
import { PreviewWorkerCoordinator } from '../PreviewWorkerCoordinator';
import { AssetTextureCache } from '../../lib/textures/AssetTextureCache';
import { WebAudioEngine } from '../../lib/audio';
import type { WorkerRenderOptions } from '../workers/PreviewWorkerBridge';
import type { IPreviewRenderStrategy } from './IPreviewRenderStrategy';

export class MainThreadRenderStrategy implements IPreviewRenderStrategy {
  public readonly id = 'main-thread' as const;
  private canvas: HTMLCanvasElement | null = null;
  private engine: IRPreviewEngine | null = null;
  private ready = false;
  private width = 1920;
  private height = 1080;
  private timeline: ResolvedTimeline | null = null;
  private readyCallbacks: (() => void)[] = [];

  public get isReady(): boolean {
    return this.ready;
  }

  public getEngine(): IRPreviewEngine | null {
    return this.engine;
  }

  public init(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;
    if (this.timeline) {
      this.recreateEngine(this.timeline);
    }
    this.ready = true;
    for (const cb of this.readyCallbacks) {
      cb();
    }
    this.readyCallbacks = [];
    return true;
  }

  private recreateEngine(timeline: ResolvedTimeline): void {
    let coordinator: PreviewWorkerCoordinator | null = null;
    try {
      coordinator = PreviewWorkerCoordinator.getInstance();
    } catch {
      // In headless test environments without DOM window
    }

    this.engine = new IRPreviewEngine(
      timeline,
      undefined,
      undefined,
      48000,
      {
        sidecarCoordinator: coordinator,
        autoPreflight: coordinator !== null,
      }
    );
    try {
      WebAudioEngine.getInstance().attachPreviewEngine(this.engine);
    } catch {
      // Audio engine optional in test/headless environments
    }
  }

  public updateTimeline(
    timeline: ResolvedTimeline,
    _totalFrames: number,
    _fps: number,
    _assets?: Record<string, any>
  ): void {
    this.timeline = timeline;
    this.recreateEngine(timeline);
  }

  public async syncTextures(
    activeSeqs: ResolvedSequence[],
    assets: Record<string, any>,
    currentFrame: number,
    fps: number
  ): Promise<void> {
    if (!this.engine) return;

    const assetTextureCache = AssetTextureCache.getInstance();

    for (const seq of activeSeqs) {
      if (!seq.assetId) continue;

      const assetDef = assets[seq.assetId];
      const assetSrc = assetDef?.src;
      const assetType = assetDef?.type;
      const seqStart = seq.startFrame ?? 0;
      const seqLocalTimeSec = Math.max(0, (currentFrame - seqStart) / (fps || 30));

      const visualAsset = assetTextureCache.getVisualAsset(
        seq.assetId,
        assetSrc,
        (assetType as any) || 'image',
        seqLocalTimeSec
      );

      if (visualAsset.source) {
        assetTextureCache.set(seq.assetId, visualAsset.source);
      }
    }
  }

  public renderFrame(frame: number, options?: WorkerRenderOptions): void {
    if (!this.canvas || !this.engine) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const clearColor = options?.clearColor || '#000000';
    if (clearColor === 'transparent') {
      ctx.clearRect(0, 0, this.width, this.height);
    } else {
      ctx.fillStyle = clearColor;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    this.engine.renderFrame(frame, ctx, {
      textureCache: this.engine.getTextureCache(),
      lodScale: options?.lod ?? 1.0,
      clearColor,
      debugMode: options?.debugMode,
    });
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  public onReady(callback: () => void): void {
    if (this.ready) {
      callback();
    } else {
      this.readyCallbacks.push(callback);
    }
  }

  public dispose(): void {
    if (this.engine) {
      try {
        this.engine.getTextureCache().dispose();
      } catch {}
    }
    this.canvas = null;
    this.engine = null;
    this.ready = false;
  }

  public getEngine(): IRPreviewEngine | null {
    return this.engine;
  }
}
