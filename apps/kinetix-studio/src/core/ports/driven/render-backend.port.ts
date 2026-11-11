// ============================================================================
// KINETIX STUDIO v6.0 - RENDER BACKEND PORT (ECMA-429)
// Driven port defining hardware acceleration backend capabilities & contracts.
// ============================================================================

export type RenderBackendType = 'webgpu' | 'webgl2' | 'canvas2d';

export interface RenderBackendCapabilities {
  readonly backend: RenderBackendType;
  readonly maxTextureSize: number;
  readonly computeShadersSupported: boolean;
  readonly floatTexturesSupported: boolean;
  readonly pbrShadingSupported: boolean;
  readonly vendorName?: string;
  readonly rendererName?: string;
}

export interface IRenderBackend {
  readonly capabilities: RenderBackendCapabilities;
  init(): Promise<boolean>;
  render(target: HTMLCanvasElement | CanvasRenderingContext2D, uniforms: Record<string, unknown>): void;
  dispose(): void;
  [Symbol.dispose](): void;
}
