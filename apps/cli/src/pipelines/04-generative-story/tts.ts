import { PythonBackend } from '@acc/core/ai-backend/python/PythonBackend';
import { defaultIPCFacade } from '@acc/core';
import { TtsConfig } from '@acc/core/types';
import fs from 'fs';
import path from 'path';

export async function tts(
  text: string,
  settings: TtsConfig,
  fileName: string,
  outputDir: string,
  backend?: PythonBackend
): Promise<{ file: string }> {
  console.log(`[TTS] Requesting audio synthesis for text: "${text.slice(0, 30)}..." with voice: ${settings.voice}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const finalName = fileName.endsWith('.wav') ? fileName : `${fileName}.wav`;
  const targetPath = path.join(outputDir, finalName);

  if (backend) {
    try {
      const res = await backend.dispatchTask<{ file: string }>('vieneu', 'synthesize', {
        text,
        voice: settings.voice,
        speed: settings.speed || 1.0,
        fileName,
        outputDir
      });
      if (res && res.file && fs.existsSync(res.file)) {
        console.log(`[TTS] Audio generated successfully via Vieneu: ${res.file}`);
        return res;
      }
    } catch (err: any) {
      console.warn(`[TTS] Vieneu worker error: ${err.message || err}. Falling back to IPCFacade...`);
    }
  }

  try {
    const ttsRes = await defaultIPCFacade.synthesizeSpeech(text, settings.voice, settings.speed || 1.0);
    fs.writeFileSync(targetPath, ttsRes.audioBuffer);
    console.log(`[TTS] Audio generated successfully via IPCFacade: ${targetPath}`);
    return { file: targetPath };
  } catch (error: any) {
    console.error('[TTS] Failed to generate audio:', error);
    throw error;
  }
}
