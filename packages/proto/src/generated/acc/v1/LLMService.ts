// Original file: proto/acc/v1/llm.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { LLMJsonRequest as _acc_v1_LLMJsonRequest, LLMJsonRequest__Output as _acc_v1_LLMJsonRequest__Output } from '../../acc/v1/LLMJsonRequest';
import type { LLMJsonResponse as _acc_v1_LLMJsonResponse, LLMJsonResponse__Output as _acc_v1_LLMJsonResponse__Output } from '../../acc/v1/LLMJsonResponse';
import type { PingRequest as _acc_v1_PingRequest, PingRequest__Output as _acc_v1_PingRequest__Output } from '../../acc/v1/PingRequest';
import type { PingResponse as _acc_v1_PingResponse, PingResponse__Output as _acc_v1_PingResponse__Output } from '../../acc/v1/PingResponse';

export interface LLMServiceClient extends grpc.Client {
  GenerateStructuredJson(argument: _acc_v1_LLMJsonRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_LLMJsonResponse__Output>): grpc.ClientUnaryCall;
  GenerateStructuredJson(argument: _acc_v1_LLMJsonRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_LLMJsonResponse__Output>): grpc.ClientUnaryCall;
  GenerateStructuredJson(argument: _acc_v1_LLMJsonRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_LLMJsonResponse__Output>): grpc.ClientUnaryCall;
  GenerateStructuredJson(argument: _acc_v1_LLMJsonRequest, callback: grpc.requestCallback<_acc_v1_LLMJsonResponse__Output>): grpc.ClientUnaryCall;
  generateStructuredJson(argument: _acc_v1_LLMJsonRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_LLMJsonResponse__Output>): grpc.ClientUnaryCall;
  generateStructuredJson(argument: _acc_v1_LLMJsonRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_LLMJsonResponse__Output>): grpc.ClientUnaryCall;
  generateStructuredJson(argument: _acc_v1_LLMJsonRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_LLMJsonResponse__Output>): grpc.ClientUnaryCall;
  generateStructuredJson(argument: _acc_v1_LLMJsonRequest, callback: grpc.requestCallback<_acc_v1_LLMJsonResponse__Output>): grpc.ClientUnaryCall;
  
  Ping(argument: _acc_v1_PingRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  Ping(argument: _acc_v1_PingRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  Ping(argument: _acc_v1_PingRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  Ping(argument: _acc_v1_PingRequest, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  ping(argument: _acc_v1_PingRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  ping(argument: _acc_v1_PingRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  ping(argument: _acc_v1_PingRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  ping(argument: _acc_v1_PingRequest, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  
}

export interface LLMServiceHandlers extends grpc.UntypedServiceImplementation {
  GenerateStructuredJson: grpc.handleUnaryCall<_acc_v1_LLMJsonRequest__Output, _acc_v1_LLMJsonResponse>;
  
  Ping: grpc.handleUnaryCall<_acc_v1_PingRequest__Output, _acc_v1_PingResponse>;
  
}

export interface LLMServiceDefinition extends grpc.ServiceDefinition {
  GenerateStructuredJson: MethodDefinition<_acc_v1_LLMJsonRequest, _acc_v1_LLMJsonResponse, _acc_v1_LLMJsonRequest__Output, _acc_v1_LLMJsonResponse__Output>
  Ping: MethodDefinition<_acc_v1_PingRequest, _acc_v1_PingResponse, _acc_v1_PingRequest__Output, _acc_v1_PingResponse__Output>
}
