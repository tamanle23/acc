// Original file: proto/acc/v1/llm.proto


export interface LLMJsonRequest {
  'prompt'?: (string);
  'jsonSchema'?: (string);
  'systemInstruction'?: (string);
  'temperature'?: (number | string);
}

export interface LLMJsonRequest__Output {
  'prompt': (string);
  'jsonSchema': (string);
  'systemInstruction': (string);
  'temperature': (number);
}
