import fs from 'fs';
import path from 'path';
import { Logger } from '@acc/core';
import {
  IRConfigAdapterRegistry,
  type VideoIRDocument,
} from '@acc/ir';
import { StudioServer } from '../studio/StudioServer';
import { note, log } from '../prompts';

export interface StudioCliOptions {
  input?: string;
  port?: number;
  keepAlive?: boolean;
}

/**
 * Handles the 'studio' command line execution.
 * Spins up local HTTP Studio editor server for visual scrubbing and live JSON Patch AST editing.
 */
export async function handleStudioCommand(options: StudioCliOptions): Promise<StudioServer> {
  if (!options.input) {
    throw new Error('Studio input path is required. Please specify a path to a project directory or Video IR JSON document.');
  }

  let inputPath = path.resolve(options.input);

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

  if (process.stdout.isTTY) {
    note(
      `Local Server: ${serverUrl}\n` +
      `Active Project: ${irDoc.meta.contentId}\n` +
      `Canvas: ${irDoc.meta.canvasSize.w}x${irDoc.meta.canvasSize.h} @ ${irDoc.meta.globalFps}fps\n` +
      `Tracks: ${irDoc.tracks.length}\n\n` +
      `Interactive Preview active. Press Ctrl+C to terminate server.`,
      '✨ ACC Studio Live Preview'
    );
  }

  if (options.keepAlive) {
    Logger.info('StudioCommand', 'Studio server is running. Press Ctrl+C to stop.');
    await new Promise<void>((resolve) => {
      let isShuttingDown = false;
      const shutdown = () => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        if (process.stdout.isTTY) {
          log.info('Shutting down Studio server gracefully...');
        } else {
          Logger.info('StudioCommand', 'Shutting down Studio server gracefully...');
        }
        studio.stop();
        resolve();
      };

      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    });
  }

  return studio;
}
