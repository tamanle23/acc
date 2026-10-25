// Original file: proto/acc/v1/tts.proto


export interface TTSRequest {
  'text'?: (string);
  'voiceId'?: (string);
  'speed'?: (number | string);
  'modelStrategy'?: (string);
}

export interface TTSRequest__Output {
  'text': (string);
  'voiceId': (string);
  'speed': (number);
  'modelStrategy': (string);
}
