import { AssetContext } from './AssetContext';
import { ResolvedStoryConfig } from './types';

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
