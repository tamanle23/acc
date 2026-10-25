// Original file: proto/acc/v1/common.proto

import type { Long } from '@grpc/proto-loader';

export interface PingResponse {
  'message'?: (string);
  'timestampMs'?: (number | string | Long);
  'status'?: (string);
}

export interface PingResponse__Output {
  'message': (string);
  'timestampMs': (string);
  'status': (string);
}
