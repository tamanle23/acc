import { BoundingBox } from "../types";

export interface SegmentationOptions {
  points?: Array<{ x: number; y: number; label?: number }>;
  box?: [number, number, number, number]; // [x1, y1, x2, y2]
  fillInternalHoles?: boolean;
  featherRadius?: number;
  threshold?: number;
}

export interface SegmentationResult {
  maskRgbaBuffer: Buffer;
  maskAlphaBuffer: Buffer;
  boundingBox: BoundingBox;
  confidence: number;
  modelUsed: string;
}

export interface ISegmentationStrategy {
  readonly name: string;
  readonly modelId: string;
  init(): Promise<void>;
  segment(imageBuffer: Buffer, options?: SegmentationOptions): Promise<SegmentationResult>;
}

export interface DepthOptions {
  modelSize?: 'small' | 'base' | 'large';
  normalizeRange?: [number, number]; // [min, max] default [0.5, 8.5]
}

export interface DepthResult {
  depth16Buffer: Buffer;
  minDepth: number;
  maxDepth: number;
  modelUsed: string;
}

export interface IDepthEstimationStrategy {
  readonly name: string;
  readonly modelId: string;
  init(): Promise<void>;
  estimateDepth(imageBuffer: Buffer, options?: DepthOptions): Promise<DepthResult>;
}
