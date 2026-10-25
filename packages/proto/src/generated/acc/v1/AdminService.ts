// Original file: proto/acc/v1/admin.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { PurgeVRAMRequest as _acc_v1_PurgeVRAMRequest, PurgeVRAMRequest__Output as _acc_v1_PurgeVRAMRequest__Output } from '../../acc/v1/PurgeVRAMRequest';
import type { PurgeVRAMResponse as _acc_v1_PurgeVRAMResponse, PurgeVRAMResponse__Output as _acc_v1_PurgeVRAMResponse__Output } from '../../acc/v1/PurgeVRAMResponse';
import type { VRAMStatusRequest as _acc_v1_VRAMStatusRequest, VRAMStatusRequest__Output as _acc_v1_VRAMStatusRequest__Output } from '../../acc/v1/VRAMStatusRequest';
import type { VRAMStatusResponse as _acc_v1_VRAMStatusResponse, VRAMStatusResponse__Output as _acc_v1_VRAMStatusResponse__Output } from '../../acc/v1/VRAMStatusResponse';

export interface AdminServiceClient extends grpc.Client {
  GetVRAMStatus(argument: _acc_v1_VRAMStatusRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_VRAMStatusResponse__Output>): grpc.ClientUnaryCall;
  GetVRAMStatus(argument: _acc_v1_VRAMStatusRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_VRAMStatusResponse__Output>): grpc.ClientUnaryCall;
  GetVRAMStatus(argument: _acc_v1_VRAMStatusRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_VRAMStatusResponse__Output>): grpc.ClientUnaryCall;
  GetVRAMStatus(argument: _acc_v1_VRAMStatusRequest, callback: grpc.requestCallback<_acc_v1_VRAMStatusResponse__Output>): grpc.ClientUnaryCall;
  getVramStatus(argument: _acc_v1_VRAMStatusRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_VRAMStatusResponse__Output>): grpc.ClientUnaryCall;
  getVramStatus(argument: _acc_v1_VRAMStatusRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_VRAMStatusResponse__Output>): grpc.ClientUnaryCall;
  getVramStatus(argument: _acc_v1_VRAMStatusRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_VRAMStatusResponse__Output>): grpc.ClientUnaryCall;
  getVramStatus(argument: _acc_v1_VRAMStatusRequest, callback: grpc.requestCallback<_acc_v1_VRAMStatusResponse__Output>): grpc.ClientUnaryCall;
  
  PurgeVRAM(argument: _acc_v1_PurgeVRAMRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_PurgeVRAMResponse__Output>): grpc.ClientUnaryCall;
  PurgeVRAM(argument: _acc_v1_PurgeVRAMRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_PurgeVRAMResponse__Output>): grpc.ClientUnaryCall;
  PurgeVRAM(argument: _acc_v1_PurgeVRAMRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_PurgeVRAMResponse__Output>): grpc.ClientUnaryCall;
  PurgeVRAM(argument: _acc_v1_PurgeVRAMRequest, callback: grpc.requestCallback<_acc_v1_PurgeVRAMResponse__Output>): grpc.ClientUnaryCall;
  purgeVram(argument: _acc_v1_PurgeVRAMRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_PurgeVRAMResponse__Output>): grpc.ClientUnaryCall;
  purgeVram(argument: _acc_v1_PurgeVRAMRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_PurgeVRAMResponse__Output>): grpc.ClientUnaryCall;
  purgeVram(argument: _acc_v1_PurgeVRAMRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_PurgeVRAMResponse__Output>): grpc.ClientUnaryCall;
  purgeVram(argument: _acc_v1_PurgeVRAMRequest, callback: grpc.requestCallback<_acc_v1_PurgeVRAMResponse__Output>): grpc.ClientUnaryCall;
  
}

export interface AdminServiceHandlers extends grpc.UntypedServiceImplementation {
  GetVRAMStatus: grpc.handleUnaryCall<_acc_v1_VRAMStatusRequest__Output, _acc_v1_VRAMStatusResponse>;
  
  PurgeVRAM: grpc.handleUnaryCall<_acc_v1_PurgeVRAMRequest__Output, _acc_v1_PurgeVRAMResponse>;
  
}

export interface AdminServiceDefinition extends grpc.ServiceDefinition {
  GetVRAMStatus: MethodDefinition<_acc_v1_VRAMStatusRequest, _acc_v1_VRAMStatusResponse, _acc_v1_VRAMStatusRequest__Output, _acc_v1_VRAMStatusResponse__Output>
  PurgeVRAM: MethodDefinition<_acc_v1_PurgeVRAMRequest, _acc_v1_PurgeVRAMResponse, _acc_v1_PurgeVRAMRequest__Output, _acc_v1_PurgeVRAMResponse__Output>
}
