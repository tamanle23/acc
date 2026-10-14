import fs from 'fs';
import path from 'path';
import { Logger } from '@acc/core';
import {
  IRConfigAdapterRegistry,
  type VideoIRDocument,
} from '@acc/ir';
import { StudioServer } from '../studio/StudioServer';

export interface StudioCliOptions {
  input?: string;
  port?: number;
}

/**
 * Handles the 'studio' command line execution.
 * Spins up local HTTP Studio editor server for visual scrubbing and live JSON Patch AST editing.
 */
export async function handleStudioCommand(options: StudioCliOptions): Promise<StudioServer> {
  let inputPath = options.input ? path.resolve(options.input) : path.resolve('./sample-story');

  if (fs.existsSync(inputPath) && fs.statSync(inputPath).isDirectory()) {
    const candidates = ['video-ir.json', 'pipeline-ir.json', 'story-config.json', 'omnichannel-config.json'];
    for (const file of candidates) {
      const candidate = path.join(inputPath, file);
      if (fs.existsSync(candidate)) {
        inputPath = candidate;
        break;
      }
    }
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Studio input path does not exist: ${inputPath}`);
  }

  Logger.info('StudioCommand', `Loading timeline project from: ${inputPath}`);
  const rawContent = await fs.promises.readFile(inputPath, 'utf-8');
  const baseDir = path.dirname(inputPath);
  const parsed = JSON.parse(rawContent);

  const registry = IRConfigAdapterRegistry.getInstance();
  const irDoc: VideoIRDocument = registry.transform(parsed, { baseDir });

  const port = options.port || 3300;
  const studio = new StudioServer(irDoc, { port, baseDir });
  const serverUrl = await studio.start();

  Logger.info('StudioCommand', `✨ Dual-Engine Studio Preview live at: ${serverUrl}`);
  return studio;
}
