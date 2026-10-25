// Original file: proto/acc/v1/tts.proto


export interface AudioChunk {
  'pcmBytes'?: (Buffer | Uint8Array | string);
  'sequenceNumber'?: (number);
  'isFinal'?: (boolean);
}

export interface AudioChunk__Output {
  'pcmBytes': (Buffer);
  'sequenceNumber': (number);
  'isFinal': (boolean);
}
