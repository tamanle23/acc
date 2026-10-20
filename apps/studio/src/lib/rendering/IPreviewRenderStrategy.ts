/**
 * IPreviewRenderStrategy:
 * Strategy pattern interface for decoupled preview canvas rendering.
 * Supports both OffscreenCanvas in Web Worker and MainThread direct rendering.
 */
export interface PreviewRenderOptions {
  lod?: number;
  popOutIntensity?: number;
}

export interface IPreviewRenderStrategy {
  renderFrame(frame: number, options?: PreviewRenderOptions): void;
  updateTextures?(textures: Record<string, ImageBitmap>): void;
  updateTimeline?(timeline: any, totalFrames: number, fps: number): void;
  destroy(): void;
}
