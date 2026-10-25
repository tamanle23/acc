// Original file: proto/acc/v1/llm.proto

import type { Long } from '@grpc/proto-loader';

export interface LLMJsonResponse {
  'jsonOutput'?: (string);
  'tokensUsed'?: (number);
  'latencyMs'?: (number | string | Long);
}

export interface LLMJsonResponse__Output {
  'jsonOutput': (string);
  'tokensUsed': (number);
  'latencyMs': (string);
}
