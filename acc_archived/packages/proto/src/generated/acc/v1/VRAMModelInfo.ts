// Original file: proto/acc/v1/admin.proto

import type { Long } from '@grpc/proto-loader';

export interface VRAMModelInfo {
  'name'?: (string);
  'vramMb'?: (number | string | Long);
  'accessCount'?: (number);
}

export interface VRAMModelInfo__Output {
  'name': (string);
  'vramMb': (string);
  'accessCount': (number);
}
