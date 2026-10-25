// Original file: proto/acc/v1/admin.proto

import type { Long } from '@grpc/proto-loader';

export interface PurgeVRAMResponse {
  'success'?: (boolean);
  'freedBytes'?: (number | string | Long);
  'message'?: (string);
}

export interface PurgeVRAMResponse__Output {
  'success': (boolean);
  'freedBytes': (string);
  'message': (string);
}
