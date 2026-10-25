import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { BoundingBox as _acc_v1_BoundingBox, BoundingBox__Output as _acc_v1_BoundingBox__Output } from './acc/v1/BoundingBox';
import type { PingRequest as _acc_v1_PingRequest, PingRequest__Output as _acc_v1_PingRequest__Output } from './acc/v1/PingRequest';
import type { PingResponse as _acc_v1_PingResponse, PingResponse__Output as _acc_v1_PingResponse__Output } from './acc/v1/PingResponse';
import type { StatusResponse as _acc_v1_StatusResponse, StatusResponse__Output as _acc_v1_StatusResponse__Output } from './acc/v1/StatusResponse';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  acc: {
    v1: {
      BoundingBox: MessageTypeDefinition<_acc_v1_BoundingBox, _acc_v1_BoundingBox__Output>
      PingRequest: MessageTypeDefinition<_acc_v1_PingRequest, _acc_v1_PingRequest__Output>
      PingResponse: MessageTypeDefinition<_acc_v1_PingResponse, _acc_v1_PingResponse__Output>
      StatusResponse: MessageTypeDefinition<_acc_v1_StatusResponse, _acc_v1_StatusResponse__Output>
    }
  }
}

