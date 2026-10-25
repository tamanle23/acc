// Original file: proto/acc/v1/vision.proto


export interface SegmentationRequest {
  'imageData'?: (Buffer | Uint8Array | string);
  'promptBox'?: (number | string)[];
  'mode'?: (string);
}

export interface SegmentationRequest__Output {
  'imageData': (Buffer);
  'promptBox': (number)[];
  'mode': (string);
}
