// Original file: proto/acc/v1/tts.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { AudioChunk as _acc_v1_AudioChunk, AudioChunk__Output as _acc_v1_AudioChunk__Output } from '../../acc/v1/AudioChunk';
import type { PingRequest as _acc_v1_PingRequest, PingRequest__Output as _acc_v1_PingRequest__Output } from '../../acc/v1/PingRequest';
import type { PingResponse as _acc_v1_PingResponse, PingResponse__Output as _acc_v1_PingResponse__Output } from '../../acc/v1/PingResponse';
import type { TTSRequest as _acc_v1_TTSRequest, TTSRequest__Output as _acc_v1_TTSRequest__Output } from '../../acc/v1/TTSRequest';
import type { TTSResponse as _acc_v1_TTSResponse, TTSResponse__Output as _acc_v1_TTSResponse__Output } from '../../acc/v1/TTSResponse';

export interface TTSServiceClient extends grpc.Client {
  Ping(argument: _acc_v1_PingRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  Ping(argument: _acc_v1_PingRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  Ping(argument: _acc_v1_PingRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  Ping(argument: _acc_v1_PingRequest, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  ping(argument: _acc_v1_PingRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  ping(argument: _acc_v1_PingRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  ping(argument: _acc_v1_PingRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  ping(argument: _acc_v1_PingRequest, callback: grpc.requestCallback<_acc_v1_PingResponse__Output>): grpc.ClientUnaryCall;
  
  Synthesize(argument: _acc_v1_TTSRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_TTSResponse__Output>): grpc.ClientUnaryCall;
  Synthesize(argument: _acc_v1_TTSRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_TTSResponse__Output>): grpc.ClientUnaryCall;
  Synthesize(argument: _acc_v1_TTSRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_TTSResponse__Output>): grpc.ClientUnaryCall;
  Synthesize(argument: _acc_v1_TTSRequest, callback: grpc.requestCallback<_acc_v1_TTSResponse__Output>): grpc.ClientUnaryCall;
  synthesize(argument: _acc_v1_TTSRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_TTSResponse__Output>): grpc.ClientUnaryCall;
  synthesize(argument: _acc_v1_TTSRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_acc_v1_TTSResponse__Output>): grpc.ClientUnaryCall;
  synthesize(argument: _acc_v1_TTSRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_acc_v1_TTSResponse__Output>): grpc.ClientUnaryCall;
  synthesize(argument: _acc_v1_TTSRequest, callback: grpc.requestCallback<_acc_v1_TTSResponse__Output>): grpc.ClientUnaryCall;
  
  SynthesizeStream(argument: _acc_v1_TTSRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_acc_v1_AudioChunk__Output>;
  SynthesizeStream(argument: _acc_v1_TTSRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_acc_v1_AudioChunk__Output>;
  synthesizeStream(argument: _acc_v1_TTSRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_acc_v1_AudioChunk__Output>;
  synthesizeStream(argument: _acc_v1_TTSRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_acc_v1_AudioChunk__Output>;
  
}

export interface TTSServiceHandlers extends grpc.UntypedServiceImplementation {
  Ping: grpc.handleUnaryCall<_acc_v1_PingRequest__Output, _acc_v1_PingResponse>;
  
  Synthesize: grpc.handleUnaryCall<_acc_v1_TTSRequest__Output, _acc_v1_TTSResponse>;
  
  SynthesizeStream: grpc.handleServerStreamingCall<_acc_v1_TTSRequest__Output, _acc_v1_AudioChunk>;
  
}

export interface TTSServiceDefinition extends grpc.ServiceDefinition {
  Ping: MethodDefinition<_acc_v1_PingRequest, _acc_v1_PingResponse, _acc_v1_PingRequest__Output, _acc_v1_PingResponse__Output>
  Synthesize: MethodDefinition<_acc_v1_TTSRequest, _acc_v1_TTSResponse, _acc_v1_TTSRequest__Output, _acc_v1_TTSResponse__Output>
  SynthesizeStream: MethodDefinition<_acc_v1_TTSRequest, _acc_v1_AudioChunk, _acc_v1_TTSRequest__Output, _acc_v1_AudioChunk__Output>
}
