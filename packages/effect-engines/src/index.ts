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
export * from './canvas';

// Auto-register adapters for runtime environments
try {
  UniversalCanvasProvider.registerAdapter(new WebCanvasAdapter());
} catch {
  // Graceful fallback
}

try {
  UniversalCanvasProvider.registerAdapter(new NodeCanvasAdapter(), true);
} catch {
  // Graceful fallback in non-node environments
}
