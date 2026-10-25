import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { AdminServiceClient as _acc_v1_AdminServiceClient, AdminServiceDefinition as _acc_v1_AdminServiceDefinition } from './acc/v1/AdminService';
import type { PurgeVRAMRequest as _acc_v1_PurgeVRAMRequest, PurgeVRAMRequest__Output as _acc_v1_PurgeVRAMRequest__Output } from './acc/v1/PurgeVRAMRequest';
import type { PurgeVRAMResponse as _acc_v1_PurgeVRAMResponse, PurgeVRAMResponse__Output as _acc_v1_PurgeVRAMResponse__Output } from './acc/v1/PurgeVRAMResponse';
import type { VRAMModelInfo as _acc_v1_VRAMModelInfo, VRAMModelInfo__Output as _acc_v1_VRAMModelInfo__Output } from './acc/v1/VRAMModelInfo';
import type { VRAMStatusRequest as _acc_v1_VRAMStatusRequest, VRAMStatusRequest__Output as _acc_v1_VRAMStatusRequest__Output } from './acc/v1/VRAMStatusRequest';
import type { VRAMStatusResponse as _acc_v1_VRAMStatusResponse, VRAMStatusResponse__Output as _acc_v1_VRAMStatusResponse__Output } from './acc/v1/VRAMStatusResponse';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  acc: {
    v1: {
      AdminService: SubtypeConstructor<typeof grpc.Client, _acc_v1_AdminServiceClient> & { service: _acc_v1_AdminServiceDefinition }
      PurgeVRAMRequest: MessageTypeDefinition<_acc_v1_PurgeVRAMRequest, _acc_v1_PurgeVRAMRequest__Output>
      PurgeVRAMResponse: MessageTypeDefinition<_acc_v1_PurgeVRAMResponse, _acc_v1_PurgeVRAMResponse__Output>
      VRAMModelInfo: MessageTypeDefinition<_acc_v1_VRAMModelInfo, _acc_v1_VRAMModelInfo__Output>
      VRAMStatusRequest: MessageTypeDefinition<_acc_v1_VRAMStatusRequest, _acc_v1_VRAMStatusRequest__Output>
      VRAMStatusResponse: MessageTypeDefinition<_acc_v1_VRAMStatusResponse, _acc_v1_VRAMStatusResponse__Output>
    }
  }
}

