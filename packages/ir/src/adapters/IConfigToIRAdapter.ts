import type { VideoIRDocument } from '../types/VideoIR';

export interface AdapterOptions {
  contentId?: string;
  globalFps?: number;
  canvasSize?: { w: number; h: number };
  [key: string]: unknown;
}

/**
 * IConfigToIRAdapter:
 * Strategy contract for transforming heterogeneous config structures
 * into schema-compliant V1.0-Stable Video IR documents.
 */
export interface IConfigToIRAdapter<TConfig = unknown> {
  readonly id: string;
  readonly name: string;
  readonly version: string;

  /**
   * Fast probe to verify if the given config structure is handled by this adapter.
   */
  canAdapt(config: unknown): boolean;

  /**
   * Translates the given configuration into canonical Video IR.
   */
  adapt(config: TConfig, options?: AdapterOptions): VideoIRDocument;
}
