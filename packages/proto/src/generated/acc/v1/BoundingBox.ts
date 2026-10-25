// Original file: proto/acc/v1/common.proto


export interface BoundingBox {
  'x'?: (number | string);
  'y'?: (number | string);
  'width'?: (number | string);
  'height'?: (number | string);
  'confidence'?: (number | string);
}

export interface BoundingBox__Output {
  'x': (number);
  'y': (number);
  'width': (number);
  'height': (number);
  'confidence': (number);
}
