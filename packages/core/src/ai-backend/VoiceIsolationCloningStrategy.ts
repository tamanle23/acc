import fs from 'fs';
import path from 'path';
import { fileExists } from '../utils';

export interface VoiceCloneOptions {
  referenceAudioPath: string;
  targetText: string;
  language?: 'vi' | 'en';
  outputDir?: string;
}

export class VoiceIsolationCloningStrategy {
  public static async synthesizeClonedVoice(options: VoiceCloneOptions): Promise<string> {
    const outDir = options.outputDir || '/tmp/acc_ai_cache';
    // ⚡ Bolt: Replaced synchronous fs.existsSync/mkdirSync with async fileExists/fs.promises.mkdir
    // 🎯 Why: Synchronous file operations block the Node.js event loop causing significant latency for other requests
    // 📊 Impact: Improves concurrency and unblocks the main thread.
    if (!(await fileExists(outDir))) {
      await fs.promises.mkdir(outDir, { recursive: true });
    }

    const fileName = `cloned_voice_${Date.now()}.mp3`;
    const outputPath = path.join(outDir, fileName);

    // ⚡ Bolt: Replaced synchronous fs.existsSync/writeFileSync with async fileExists/fs.promises.writeFile
    // 🎯 Why: Synchronous I/O blocks the event loop
    if (!(await fileExists(outputPath))) {
      await fs.promises.writeFile(outputPath, Buffer.alloc(1024, 0x00));
    }

    return outputPath;
  }
}
