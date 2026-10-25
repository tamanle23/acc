import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { AudioChunk as _acc_v1_AudioChunk, AudioChunk__Output as _acc_v1_AudioChunk__Output } from './acc/v1/AudioChunk';
import type { BoundingBox as _acc_v1_BoundingBox, BoundingBox__Output as _acc_v1_BoundingBox__Output } from './acc/v1/BoundingBox';
import type { PingRequest as _acc_v1_PingRequest, PingRequest__Output as _acc_v1_PingRequest__Output } from './acc/v1/PingRequest';
import type { PingResponse as _acc_v1_PingResponse, PingResponse__Output as _acc_v1_PingResponse__Output } from './acc/v1/PingResponse';
import type { StatusResponse as _acc_v1_StatusResponse, StatusResponse__Output as _acc_v1_StatusResponse__Output } from './acc/v1/StatusResponse';
import type { TTSRequest as _acc_v1_TTSRequest, TTSRequest__Output as _acc_v1_TTSRequest__Output } from './acc/v1/TTSRequest';
import type { TTSResponse as _acc_v1_TTSResponse, TTSResponse__Output as _acc_v1_TTSResponse__Output } from './acc/v1/TTSResponse';
import type { TTSServiceClient as _acc_v1_TTSServiceClient, TTSServiceDefinition as _acc_v1_TTSServiceDefinition } from './acc/v1/TTSService';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  acc: {
    v1: {
      AudioChunk: MessageTypeDefinition<_acc_v1_AudioChunk, _acc_v1_AudioChunk__Output>
      BoundingBox: MessageTypeDefinition<_acc_v1_BoundingBox, _acc_v1_BoundingBox__Output>
      PingRequest: MessageTypeDefinition<_acc_v1_PingRequest, _acc_v1_PingRequest__Output>
      PingResponse: MessageTypeDefinition<_acc_v1_PingResponse, _acc_v1_PingResponse__Output>
      StatusResponse: MessageTypeDefinition<_acc_v1_StatusResponse, _acc_v1_StatusResponse__Output>
      TTSRequest: MessageTypeDefinition<_acc_v1_TTSRequest, _acc_v1_TTSRequest__Output>
      TTSResponse: MessageTypeDefinition<_acc_v1_TTSResponse, _acc_v1_TTSResponse__Output>
      TTSService: SubtypeConstructor<typeof grpc.Client, _acc_v1_TTSServiceClient> & { service: _acc_v1_TTSServiceDefinition }
    }
  }
}

