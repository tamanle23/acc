import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { BoundingBox as _acc_v1_BoundingBox, BoundingBox__Output as _acc_v1_BoundingBox__Output } from './acc/v1/BoundingBox';
import type { DepthRequest as _acc_v1_DepthRequest, DepthRequest__Output as _acc_v1_DepthRequest__Output } from './acc/v1/DepthRequest';
import type { DepthResponse as _acc_v1_DepthResponse, DepthResponse__Output as _acc_v1_DepthResponse__Output } from './acc/v1/DepthResponse';
import type { PingRequest as _acc_v1_PingRequest, PingRequest__Output as _acc_v1_PingRequest__Output } from './acc/v1/PingRequest';
import type { PingResponse as _acc_v1_PingResponse, PingResponse__Output as _acc_v1_PingResponse__Output } from './acc/v1/PingResponse';
import type { SegmentationRequest as _acc_v1_SegmentationRequest, SegmentationRequest__Output as _acc_v1_SegmentationRequest__Output } from './acc/v1/SegmentationRequest';
import type { SegmentationResponse as _acc_v1_SegmentationResponse, SegmentationResponse__Output as _acc_v1_SegmentationResponse__Output } from './acc/v1/SegmentationResponse';
import type { StatusResponse as _acc_v1_StatusResponse, StatusResponse__Output as _acc_v1_StatusResponse__Output } from './acc/v1/StatusResponse';
import type { VisionServiceClient as _acc_v1_VisionServiceClient, VisionServiceDefinition as _acc_v1_VisionServiceDefinition } from './acc/v1/VisionService';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  acc: {
    v1: {
      BoundingBox: MessageTypeDefinition<_acc_v1_BoundingBox, _acc_v1_BoundingBox__Output>
      DepthRequest: MessageTypeDefinition<_acc_v1_DepthRequest, _acc_v1_DepthRequest__Output>
      DepthResponse: MessageTypeDefinition<_acc_v1_DepthResponse, _acc_v1_DepthResponse__Output>
      PingRequest: MessageTypeDefinition<_acc_v1_PingRequest, _acc_v1_PingRequest__Output>
      PingResponse: MessageTypeDefinition<_acc_v1_PingResponse, _acc_v1_PingResponse__Output>
      SegmentationRequest: MessageTypeDefinition<_acc_v1_SegmentationRequest, _acc_v1_SegmentationRequest__Output>
      SegmentationResponse: MessageTypeDefinition<_acc_v1_SegmentationResponse, _acc_v1_SegmentationResponse__Output>
      StatusResponse: MessageTypeDefinition<_acc_v1_StatusResponse, _acc_v1_StatusResponse__Output>
      VisionService: SubtypeConstructor<typeof grpc.Client, _acc_v1_VisionServiceClient> & { service: _acc_v1_VisionServiceDefinition }
    }
  }
}

