import { PythonBackend } from '@acc/core/ai-backend/python/PythonBackend';
import { defaultIPCFacade, Logger, fileExists } from '@acc/core';
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
  Logger.info('TTS', `Requesting audio synthesis for text: "${text.slice(0, 30)}..." with voice: ${settings.voice}`);
  // ⚡ Bolt: Replace synchronous file I/O with async operations to prevent blocking the Node.js event loop
  await fs.promises.mkdir(outputDir, { recursive: true });

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
      // ⚡ Bolt: Replace fs.existsSync with async fileExists
      if (res && res.file && await fileExists(res.file)) {
        Logger.info('TTS', `Audio generated successfully via Vieneu: ${res.file}`);
        return res;
      }
    } catch (err: any) {
      Logger.warn('TTS', `Vieneu worker error: ${err.message || err}. Falling back to IPCFacade...`);
    }
  }

  try {
    const ttsRes = await defaultIPCFacade.synthesizeSpeech(text, settings.voice, settings.speed || 1.0);
    // ⚡ Bolt: Replace fs.writeFileSync with async fs.promises.writeFile
    await fs.promises.writeFile(targetPath, ttsRes.audioBuffer);
    Logger.info('TTS', `Audio generated successfully via IPCFacade: ${targetPath}`);
    return { file: targetPath };
  } catch (error: any) {
    Logger.error('TTS', 'Failed to generate audio:', error);
    throw error;
  }
}
