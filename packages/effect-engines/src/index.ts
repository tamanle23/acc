export * from './depth3d';
export * from './depth3d/frame-breaker';
export * from './depth3d/parallax';
export * from './depth3d/sandwich';
export * from './depth3d/depth-mesh';
export * from './depth3d/wigglegram';
export * from './overlay-effects';
export * from './sound-effects';
export * from './subtitles';
export * from './vision';
export * from './types';
export * from './editing';
export * from './styles';
export { UniversalCanvasProvider, CanvasAssetLoader, type ICanvasAdapter, type ICanvasInstance, type ICanvasContext2D } from '@acc/core-isomorphic';
export { NapiCanvasAdapter as NodeCanvasAdapter, NapiCanvasAdapter } from '@acc/core';
export { WebCanvasAdapter } from '@acc/core-web';

import { UniversalCanvasProvider } from '@acc/core-isomorphic';
import { NapiCanvasAdapter } from '@acc/core';
import { WebCanvasAdapter } from '@acc/core-web';

try {
  UniversalCanvasProvider.registerAdapter(new WebCanvasAdapter());
} catch {
  // Graceful fallback
}

try {
  UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);
} catch {
  // Graceful fallback in non-native environments
}