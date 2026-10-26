import type { ICanvasInstance } from '../canvas/types';

export enum VisionDomain {
  Depth = 'depth',
  Segmentation = 'segmentation',
  Matting = 'matting',
}

export enum DepthStrategyId {
  DepthAnythingV2Small = 'depth-anything-v2-small',
  DepthAnythingV2Base = 'depth-anything-v2-base',
  GlpnMetric = 'glpn-metric',
  Heuristic = 'heuristic',
}

export enum SegmentationStrategyId {
  Rmbg14 = 'rmbg-1.4',
  BiRefNet = 'birefnet',
  GrabCutFallback = 'grabcut-fallback',
  SlimSam = 'slimsam',
}

export interface VisionImageInput {
  data: Uint8Array;
  width: number;
  height: number;
  channels?: number; // 3 = RGB, 4 = RGBA
  canvas?: ICanvasInstance; // Optional zero-copy in-memory source
}

export interface DepthOptions {
  modelSize?: 'small' | 'base' | 'large';
  normalizeRange?: [number, number]; // [min, max] default [0.5, 8.5]
}

export interface DepthEstimationResult {
  depth16Data: Uint16Array | Uint8Array;
  width: number;
  height: number;
  minDepth: number;
  maxDepth: number;
  modelUsed: string;
  depthCanvas?: ICanvasInstance;
}

export interface SegmentationOptions {
  points?: Array<{ x: number; y: number; label?: number }>;
  box?: [number, number, number, number]; // [x1, y1, x2, y2]
  fillInternalHoles?: boolean;
  featherRadius?: number;
  threshold?: number;
}

export interface SubjectSegmentationResult {
  maskAlphaData: Uint8Array; // 0..255 single channel alpha mask
  width: number;
  height: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number;
  modelUsed: string;
  maskCanvas?: ICanvasInstance;
}

export interface IDepthEstimationStrategy {
  readonly id: DepthStrategyId | string;
  readonly name: string;
  readonly isSupported: boolean;
  init?(): Promise<void>;
  estimateDepth(input: VisionImageInput, options?: DepthOptions): Promise<DepthEstimationResult>;
}

export interface ISubjectSegmentationStrategy {
  readonly id: SegmentationStrategyId | string;
  readonly name: string;
  readonly isSupported: boolean;
  init?(): Promise<void>;
  segment(input: VisionImageInput, options?: SegmentationOptions): Promise<SubjectSegmentationResult>;
}

export class VisionEngineError extends Error {
  constructor(
    public readonly domain: VisionDomain,
    public readonly strategyId: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(`[VisionEngine:${domain}:${strategyId}] ${message}`);
    this.name = 'VisionEngineError';
  }
}
