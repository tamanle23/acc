import type {
  BoundingBox,
  ICanvasInstance,
  VisionImageInput,
  SubjectSegmentationResult,
  DepthEstimationResult,
  ISubjectSegmentationStrategy,
  IDepthEstimationStrategy as IIsomorphicDepthStrategy,
} from '@acc/core-isomorphic';

export type {
  VisionImageInput,
  SubjectSegmentationResult,
  DepthEstimationResult,
  ISubjectSegmentationStrategy,
  IIsomorphicDepthStrategy,
};

export interface SegmentationOptions {
  points?: Array<{ x: number; y: number; label?: number }>;
  box?: [number, number, number, number]; // [x1, y1, x2, y2]
  fillInternalHoles?: boolean;
  featherRadius?: number;
  threshold?: number;
}

export interface SegmentationResult {
  maskRgbaBuffer: Uint8Array;
  maskAlphaBuffer: Uint8Array;
  maskAlphaData?: Uint8Array;
  boundingBox: BoundingBox;
  confidence: number;
  modelUsed: string;
  maskCanvas?: ICanvasInstance;
  width?: number;
  height?: number;
}

export interface ISegmentationStrategy {
  readonly name: string;
  readonly modelId?: string;
  init?(): Promise<void>;
  segment(
    imageBuffer: Uint8Array | ArrayBuffer | VisionImageInput,
    options?: SegmentationOptions
  ): Promise<SegmentationResult>;
}

export interface DepthOptions {
  modelSize?: 'small' | 'base' | 'large';
  normalizeRange?: [number, number]; // [min, max] default [0.5, 8.5]
}

export interface DepthResult {
  depth16Buffer: Uint8Array;
  depth16Data?: Uint16Array | Uint8Array;
  minDepth: number;
  maxDepth: number;
  modelUsed: string;
  depthCanvas?: ICanvasInstance;
  width?: number;
  height?: number;
}

export interface IDepthEstimationStrategy {
  readonly name: string;
  readonly modelId?: string;
  init?(): Promise<void>;
  estimateDepth(
    imageBuffer: Uint8Array | ArrayBuffer | VisionImageInput,
    options?: DepthOptions
  ): Promise<DepthResult>;
}
