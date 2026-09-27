import { InferenceBackend } from './core/backend/InferenceBackend';
import { TTSSettings } from './types';
import path from 'path';

export async function generateAudioFromTTS(
  text: string, 
  settings: TTSSettings, 
  outputDir: string
): Promise<string> {
  const backend = InferenceBackend.getInstance();
  
  // Create a voiceovers directory inside the output directory if needed
  const voiceoversDir = path.join(outputDir, 'voiceovers');

  console.log(`[TTS] Requesting audio synthesis for text: "${text.slice(0, 30)}..." with voice: ${settings.voice}`);
  
  try {
    const result = await backend.dispatchTask<{ file: string }>('vieneu', 'synthesize', {
      text,
      voice: settings.voice,
      speed: settings.speed || 1.0,
      outputDir: voiceoversDir
    });
    
    console.log(`[TTS] Audio generated successfully: ${result.file}`);
    return result.file;
  } catch (error) {
    console.error('[TTS] Failed to generate audio:', error);
    throw error;
  }
}
