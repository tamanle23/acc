import type { ResolvedStoryConfig } from '../types';
import { AssetContext } from './AssetContext';

export interface RenderContext {
  config: ResolvedStoryConfig;
  assets: AssetContext;
  baseDir: string;
  cacheDir: string;
  tempDir: string;
}

export interface IPlugin {
  name: string;
  execute(context: RenderContext): Promise<RenderContext>;
}
