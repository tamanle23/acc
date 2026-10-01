import { PythonBackend } from '@acc/core/ai-backend/python/PythonBackend';
import { TtsConfig } from '@acc/core/types';
import path from 'path';

export async function tts(
  text: string,
  settings: TtsConfig,
  fileName: string,
  outputDir: string,
  backend: PythonBackend
): Promise<{ file: string }> {
  if (backend) {
    console.log(`[TTS] Requesting audio synthesis for text: "${text.slice(0, 30)}..." with voice: ${settings.voice}`);

    try {
      const filePath = await backend.dispatchTask<{ file: string }>('vieneu', 'synthesize', {
        text,
        voice: settings.voice,
        speed: settings.speed || 1.0,
        fileName,
        outputDir
      });

      console.log(`[TTS] Audio generated successfully: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('[TTS] Failed to generate audio:', error);
      throw error;
    }
  } else throw new Error('PythonBackend is not initialized');
}
