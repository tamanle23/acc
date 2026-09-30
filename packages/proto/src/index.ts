import path from 'path';
import * as protoLoader from '@grpc/proto-loader';
import * as grpc from '@grpc/grpc-js';

export const PROTO_ROOT = path.resolve(__dirname, '../proto/acc/v1');

export function loadProtoDefinition(fileName: string): grpc.GrpcObject {
  const protoPath = path.join(PROTO_ROOT, fileName);
  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [PROTO_ROOT],
  });
  return grpc.loadPackageDefinition(packageDefinition);
}

export function getTTSServiceClient(endpoint: string, credentials = grpc.credentials.createInsecure()): any {
  const pkg = loadProtoDefinition('tts.proto') as any;
  return new pkg.acc.v1.TTSService(endpoint, credentials);
}

export function getVisionServiceClient(endpoint: string, credentials = grpc.credentials.createInsecure()): any {
  const pkg = loadProtoDefinition('vision.proto') as any;
  return new pkg.acc.v1.VisionService(endpoint, credentials);
}

export function getLLMServiceClient(endpoint: string, credentials = grpc.credentials.createInsecure()): any {
  const pkg = loadProtoDefinition('llm.proto') as any;
  return new pkg.acc.v1.LLMService(endpoint, credentials);
}
