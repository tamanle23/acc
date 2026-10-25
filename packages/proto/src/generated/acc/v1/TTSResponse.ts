// Original file: proto/acc/v1/tts.proto

import type { Long } from '@grpc/proto-loader';

export interface TTSResponse {
  'audioData'?: (Buffer | Uint8Array | string);
  'sampleRate'?: (number);
  'channels'?: (number);
  'durationMs'?: (number | string | Long);
}

export interface TTSResponse__Output {
  'audioData': (Buffer);
  'sampleRate': (number);
  'channels': (number);
  'durationMs': (string);
}
