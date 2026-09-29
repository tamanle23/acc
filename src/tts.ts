import { PythonBackend } from './core/PythonBackend';
import { TTSSettings } from './types';
import path from 'path';

export async function generateAudioFromTTS(
  text: string,
  settings: TTSSettings,
  outputDir: string
): Promise<string> {
  const backend = PythonBackend.getInstance();

  console.log(`[TTS] Requesting audio synthesis for text: "${text.slice(0, 30)}..." with voice: ${settings.voice}`);

  try {
    const result = await backend.dispatchTask<{ file: string }>('vieneu', 'synthesize', {
      text,
      voice: settings.voice,
      speed: settings.speed || 1.0,
      outputDir
    });

    console.log(`[TTS] Audio generated successfully: ${result.file}`);
    return result.file;
  } catch (error) {
    console.error('[TTS] Failed to generate audio:', error);
    throw error;
  }
}
