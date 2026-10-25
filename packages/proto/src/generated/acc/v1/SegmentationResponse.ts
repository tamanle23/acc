// Original file: proto/acc/v1/vision.proto

import type { BoundingBox as _acc_v1_BoundingBox, BoundingBox__Output as _acc_v1_BoundingBox__Output } from './BoundingBox';

export interface SegmentationResponse {
  'maskPng'?: (Buffer | Uint8Array | string);
  'boundingBox'?: (_acc_v1_BoundingBox | null);
  'confidence'?: (number | string);
}

export interface SegmentationResponse__Output {
  'maskPng': (Buffer);
  'boundingBox': (_acc_v1_BoundingBox__Output | null);
  'confidence': (number);
}
