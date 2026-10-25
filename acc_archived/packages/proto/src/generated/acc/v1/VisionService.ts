// Original file: proto/acc/v1/vision.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { DepthRequest as _acc_v1_DepthRequest, DepthRequest__Output as _acc_v1_DepthRequest__Output } from '../../acc/v1/DepthRequest';
import type { DepthResponse as _acc_v1_DepthResponse, DepthResponse__Output as _acc_v1_DepthResponse__Output } from '../../acc/v1/DepthResponse';
import type { PingRequest as _acc_v1_PingRequest, PingRequest__Output as _acc_v1_PingRequest__Output } from '../../acc/v1/PingRequest';
import type { PingResponse as _acc_v1_PingResponse, PingResponse__Output as _acc_v1_PingResponse__Output } from '../../acc/v1/PingResponse';
import type { SegmentationRequest as _acc_v1_SegmentationRequest, SegmentationRequest__Output as _acc_v1_SegmentationRequest__Output } from '../../acc/v1/SegmentationRequest';
import type { SegmentationResponse as _acc_v1_SegmentationResponse, SegmentationResponse__Output as _acc_v1_SegmentationResponse__Output } from '../../acc/v1/SegmentationResponse';

export interface VisionServiceClient extends grpc.Client {
  EstimateDepth(argument: _acc_v1_DepthRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_DepthResponse__Output>): grpc.ClientUnaryCall;
  EstimateDepth(argument: _acc_v1_DepthRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_DepthResponse__Output>): grpc.ClientUnaryCall;
  EstimateDepth(argument: _acc_v1_DepthRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_DepthResponse__Output>): grpc.ClientUnaryCall;
  EstimateDepth(argument: _acc_v1_DepthRequest, callback: grpc.requestCallback<_acc_v1_DepthResponse__Output>): grpc.ClientUnaryCall;
  estimateDepth(argument: _acc_v1_DepthRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_DepthResponse__Output>): grpc.ClientUnaryCall;
  estimateDepth(argument: _acc_v1_DepthRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_DepthResponse__Output>): grpc.ClientUnaryCall;
  estimateDepth(argument: _acc_v1_DepthRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_DepthResponse__Output>): grpc.ClientUnaryCall;
  estimateDepth(argument: _acc_v1_DepthRequest, callback: grpc.requestCallback<_acc_v1_DepthResponse__Output>): grpc.ClientUnaryCall;
  
  Ping(argument: _acc_v1_PingRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  Ping(argument: _acc_v1_PingRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  Ping(argument: _acc_v1_PingRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  Ping(argument: _acc_v1_PingRequest, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  ping(argument: _acc_v1_PingRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  ping(argument: _acc_v1_PingRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  ping(argument: _acc_v1_PingRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  ping(argument: _acc_v1_PingRequest, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  
  SegmentSubject(argument: _acc_v1_SegmentationRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_SegmentationResponse__Output>): grpc.ClientUnaryCall;
  SegmentSubject(argument: _acc_v1_SegmentationRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_SegmentationResponse__Output>): grpc.ClientUnaryCall;
  SegmentSubject(argument: _acc_v1_SegmentationRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_SegmentationResponse__Output>): grpc.ClientUnaryCall;
  SegmentSubject(argument: _acc_v1_SegmentationRequest, callback: grpc.requestCallback<_acc_v1_SegmentationResponse__Output>): grpc.ClientUnaryCall;
  segmentSubject(argument: _acc_v1_SegmentationRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_SegmentationResponse__Output>): grpc.ClientUnaryCall;
  segmentSubject(argument: _acc_v1_SegmentationRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_SegmentationResponse__Output>): grpc.ClientUnaryCall;
  segmentSubject(argument: _acc_v1_SegmentationRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_SegmentationResponse__Output>): grpc.ClientUnaryCall;
  segmentSubject(argument: _acc_v1_SegmentationRequest, callback: grpc.requestCallback<_acc_v1_SegmentationResponse__Output>): grpc.ClientUnaryCall;
  
}

export interface VisionServiceHandlers extends grpc.UntypedServiceImplementation {
  EstimateDepth: grpc.handleUnaryCall<_acc_v1_DepthRequest__Output, _acc_v1_DepthResponse>;
  
  Ping: grpc.handleUnaryCall<_acc_v1_PingRequest__Output, _acc_v1_PingResponse>;
  
  SegmentSubject: grpc.handleUnaryCall<_acc_v1_SegmentationRequest__Output, _acc_v1_SegmentationResponse>;
  
}

export interface VisionServiceDefinition extends grpc.ServiceDefinition {
  EstimateDepth: MethodDefinition<_acc_v1_DepthRequest, _acc_v1_DepthResponse, _acc_v1_DepthRequest__Output, _acc_v1_DepthResponse__Output>
  Ping: MethodDefinition<_acc_v1_PingRequest, _acc_v1_PingResponse, _acc_v1_PingRequest__Output, _acc_v1_PingResponse__Output>
  SegmentSubject: MethodDefinition<_acc_v1_SegmentationRequest, _acc_v1_SegmentationResponse, _acc_v1_SegmentationRequest__Output, _acc_v1_SegmentationResponse__Output>
}
