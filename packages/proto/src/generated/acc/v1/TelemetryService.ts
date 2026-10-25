// Original file: proto/acc/v1/telemetry.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { TelemetryEvent as _acc_v1_TelemetryEvent, TelemetryEvent__Output as _acc_v1_TelemetryEvent__Output } from './TelemetryEvent';
import type { TelemetryStreamRequest as _acc_v1_TelemetryStreamRequest, TelemetryStreamRequest__Output as _acc_v1_TelemetryStreamRequest__Output } from './TelemetryStreamRequest';

export interface TelemetryServiceClient extends grpc.Client {
  StreamTelemetry(argument: _acc_v1_TelemetryStreamRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_acc_v1_TelemetryEvent__Output>;
  StreamTelemetry(argument: _acc_v1_TelemetryStreamRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_acc_v1_TelemetryEvent__Output>;
  streamTelemetry(argument: _acc_v1_TelemetryStreamRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_acc_v1_TelemetryEvent__Output>;
  streamTelemetry(argument: _acc_v1_TelemetryStreamRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_acc_v1_TelemetryEvent__Output>;

}

export interface TelemetryServiceHandlers extends grpc.UntypedServiceImplementation {
  StreamTelemetry: grpc.handleServerStreamingCall<_acc_v1_TelemetryStreamRequest__Output, _acc_v1_TelemetryEvent>;

}

export interface TelemetryServiceDefinition extends grpc.ServiceDefinition {
  StreamTelemetry: MethodDefinition<_acc_v1_TelemetryStreamRequest, _acc_v1_TelemetryEvent, _acc_v1_TelemetryStreamRequest__Output, _acc_v1_TelemetryEvent__Output>
}
