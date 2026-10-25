// Original file: proto/acc/v1/vision.proto


export interface DepthResponse {
  'depthMapPng'?: (Buffer | Uint8Array | string);
  'minDepth'?: (number | string);
  'maxDepth'?: (number | string);
}

export interface DepthResponse__Output {
  'depthMapPng': (Buffer);
  'minDepth': (number);
  'maxDepth': (number);
}
