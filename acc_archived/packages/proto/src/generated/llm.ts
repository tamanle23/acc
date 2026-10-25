import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { BoundingBox as _acc_v1_BoundingBox, BoundingBox__Output as _acc_v1_BoundingBox__Output } from './acc/v1/BoundingBox';
import type { LLMJsonRequest as _acc_v1_LLMJsonRequest, LLMJsonRequest__Output as _acc_v1_LLMJsonRequest__Output } from './acc/v1/LLMJsonRequest';
import type { LLMJsonResponse as _acc_v1_LLMJsonResponse, LLMJsonResponse__Output as _acc_v1_LLMJsonResponse__Output } from './acc/v1/LLMJsonResponse';
import type { LLMServiceClient as _acc_v1_LLMServiceClient, LLMServiceDefinition as _acc_v1_LLMServiceDefinition } from './acc/v1/LLMService';
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
      LLMJsonRequest: MessageTypeDefinition<_acc_v1_LLMJsonRequest, _acc_v1_LLMJsonRequest__Output>
      LLMJsonResponse: MessageTypeDefinition<_acc_v1_LLMJsonResponse, _acc_v1_LLMJsonResponse__Output>
      LLMService: SubtypeConstructor<typeof grpc.Client, _acc_v1_LLMServiceClient> & { service: _acc_v1_LLMServiceDefinition }
      PingRequest: MessageTypeDefinition<_acc_v1_PingRequest, _acc_v1_PingRequest__Output>
      PingResponse: MessageTypeDefinition<_acc_v1_PingResponse, _acc_v1_PingResponse__Output>
      StatusResponse: MessageTypeDefinition<_acc_v1_StatusResponse, _acc_v1_StatusResponse__Output>
    }
  }
}

