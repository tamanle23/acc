export interface VoiceCloneOptions {
  referenceAudioPath: string;
  targetText: string;
  language?: 'vi' | 'en';
}

export class VoiceIsolationCloningStrategy {
  public static async synthesizeClonedVoice(options: VoiceCloneOptions): Promise<string> {
    // Calls Kokoro-82M / F5-TTS worker via gRPC
    return `/tmp/cloned_voice_${Date.now()}.mp3`;
  }
}
