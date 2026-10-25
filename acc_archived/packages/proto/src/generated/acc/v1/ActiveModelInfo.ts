// Original file: proto/acc/v1/telemetry.proto

import type { Long } from '@grpc/proto-loader';

export interface ActiveModelInfo {
  'name'?: (string);
  'allocatedBytes'?: (number | string | Long);
  'touchCount'?: (number | string | Long);
  'state'?: (string);
}

export interface ActiveModelInfo__Output {
  'name': (string);
  'allocatedBytes': (string);
  'touchCount': (string);
  'state': (string);
}
