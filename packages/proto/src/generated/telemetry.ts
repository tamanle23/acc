import type * as grpc from '@grpc/grpc-js';
import type { EnumTypeDefinition, MessageTypeDefinition } from '@grpc/proto-loader';

import type { ActiveModelInfo as _acc_v1_ActiveModelInfo, ActiveModelInfo__Output as _acc_v1_ActiveModelInfo__Output } from './acc/v1/ActiveModelInfo';
import type { TelemetryEvent as _acc_v1_TelemetryEvent, TelemetryEvent__Output as _acc_v1_TelemetryEvent__Output } from './acc/v1/TelemetryEvent';
import type { TelemetryServiceClient as _acc_v1_TelemetryServiceClient, TelemetryServiceDefinition as _acc_v1_TelemetryServiceDefinition } from './acc/v1/TelemetryService';
import type { TelemetryStreamRequest as _acc_v1_TelemetryStreamRequest, TelemetryStreamRequest__Output as _acc_v1_TelemetryStreamRequest__Output } from './acc/v1/TelemetryStreamRequest';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  acc: {
    v1: {
      ActiveModelInfo: MessageTypeDefinition<_acc_v1_ActiveModelInfo, _acc_v1_ActiveModelInfo__Output>
      TelemetryEvent: MessageTypeDefinition<_acc_v1_TelemetryEvent, _acc_v1_TelemetryEvent__Output>
      TelemetryEventType: EnumTypeDefinition
      TelemetryService: SubtypeConstructor<typeof grpc.Client, _acc_v1_TelemetryServiceClient> & { service: _acc_v1_TelemetryServiceDefinition }
      TelemetryStreamRequest: MessageTypeDefinition<_acc_v1_TelemetryStreamRequest, _acc_v1_TelemetryStreamRequest__Output>
    }
  }
}

