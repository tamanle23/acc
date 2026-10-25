// Original file: proto/acc/v1/admin.proto

import type { VRAMModelInfo as _acc_v1_VRAMModelInfo, VRAMModelInfo__Output as _acc_v1_VRAMModelInfo__Output } from '../../acc/v1/VRAMModelInfo';
import type { Long } from '@grpc/proto-loader';

export interface VRAMStatusResponse {
  'totalVramBytes'?: (number | string | Long);
  'freeVramBytes'?: (number | string | Long);
  'cachedModelCount'?: (number);
  'activeModels'?: (_acc_v1_VRAMModelInfo)[];
}

export interface VRAMStatusResponse__Output {
  'totalVramBytes': (string);
  'freeVramBytes': (string);
  'cachedModelCount': (number);
  'activeModels': (_acc_v1_VRAMModelInfo__Output)[];
}
