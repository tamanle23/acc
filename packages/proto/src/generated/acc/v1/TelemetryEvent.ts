// Original file: proto/acc/v1/telemetry.proto

import type { TelemetryEventType as _acc_v1_TelemetryEventType, TelemetryEventType__Output as _acc_v1_TelemetryEventType__Output } from './TelemetryEventType';
import type { ActiveModelInfo as _acc_v1_ActiveModelInfo, ActiveModelInfo__Output as _acc_v1_ActiveModelInfo__Output } from './ActiveModelInfo';
import type { Long } from '@grpc/proto-loader';

export interface TelemetryEvent {
  'timestampMs'?: (number | string | Long);
  'serviceName'?: (string);
  'eventType'?: (_acc_v1_TelemetryEventType);
  'message'?: (string);
  'vramAllocatedBytes'?: (number | string | Long);
  'vramReservedBytes'?: (number | string | Long);
  'vramTotalBytes'?: (number | string | Long);
  'hardwareTier'?: (string);
  'gpuUtilizationPercent'?: (number | string);
  'activeModels'?: (_acc_v1_ActiveModelInfo)[];
  'totalRegisteredModels'?: (number);
  'activeCachedModels'?: (number);
}

export interface TelemetryEvent__Output {
  'timestampMs': (string);
  'serviceName': (string);
  'eventType': (_acc_v1_TelemetryEventType__Output);
  'message': (string);
  'vramAllocatedBytes': (string);
  'vramReservedBytes': (string);
  'vramTotalBytes': (string);
  'hardwareTier': (string);
  'gpuUtilizationPercent': (number);
  'activeModels': (_acc_v1_ActiveModelInfo__Output)[];
  'totalRegisteredModels': (number);
  'activeCachedModels': (number);
}
