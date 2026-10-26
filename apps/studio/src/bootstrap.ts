import { bootstrapCoreWeb } from '@acc/core-web';

export function bootstrapClient(): void {
  // Delegate to canonical core-web client bootstrap (initializes UniversalCanvasProvider,
  // MediaEngineRegistry, ContentCacheRegistry, and VisionEngineRegistry)
  bootstrapCoreWeb();
}
