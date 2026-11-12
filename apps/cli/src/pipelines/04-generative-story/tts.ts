import { AIInferenceClient } from '@acc/ai-control-plane-sdk';
import { Logger } from '@acc/core';
import { TtsConfig } from '@acc/core/types';
import fs from 'fs';
import path from 'path';

const defaultClient = new AIInferenceClient();

export async function tts(
  text: string,
  settings: TtsConfig,
  fileName: string,
  outputDir: string,
  client: AIInferenceClient = defaultClient
): Promise<{ file: string }> {
  Logger.info('TTS', `Requesting audio synthesis for text: "${text.slice(0, 30)}..." with voice: ${settings.voice}`);
  await fs.promises.mkdir(outputDir, { recursive: true });

  const finalName = fileName.endsWith('.wav') ? fileName : `${fileName}.wav`;
  const targetPath = path.join(outputDir, finalName);

  try {
    const res = await client.synthesizeSpeech({
      text,
      voice: settings.voice || 'Hải Đăng',
      speed: settings.speed || 1.0,
    });

    await fs.promises.writeFile(targetPath, Buffer.from(res.wavBuffer));
    Logger.info('TTS', `Audio generated successfully via AI Control Plane: ${targetPath}`);
    return { file: targetPath };
  } catch (err: any) {
    Logger.warn('TTS', `Primary synthesis error: ${err.message}. Trying OpenAI-compatible TTS fallback...`);
    try {
      const openAiRes = await client.openAiSpeech({
        model: 'tts-1',
        input: text,
        voice: settings.voice || 'af_heart',
        speed: settings.speed || 1.0,
      });
      const audioData = await openAiRes.arrayBuffer();
      await fs.promises.writeFile(targetPath, Buffer.from(audioData));
      Logger.info('TTS', `Audio generated successfully via OpenAI-compatible endpoint: ${targetPath}`);
      return { file: targetPath };
    } catch (fallbackErr: any) {
      Logger.error('TTS', 'Failed to generate audio via AI Control Plane SDK:', fallbackErr);
      throw fallbackErr;
    }
  }
}
