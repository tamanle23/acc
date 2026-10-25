// Original file: proto/acc/v1/vision.proto


export interface DepthRequest {
  'imageData'?: (Buffer | Uint8Array | string);
  'modelSize'?: (string);
}

export interface DepthRequest__Output {
  'imageData': (Buffer);
  'modelSize': (string);
}
