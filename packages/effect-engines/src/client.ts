/**
 * @acc/effect-engines/client:
 * Pure browser-safe client exports for Apps/Studio and WebGL environments.
 * Strictly guarantees ZERO native C/Node.js dependencies (.node binaries, @napi-rs/canvas, fs).
 */

export * from './canvas/CanvasAssetLoader';
export * from './canvas/types';
export * from './vision/CameraSplineInterpolator';
export * from './vision/SurfaceNormalGenerator';
export * from './subtitles/SafeZoneManager';
export * from './subtitles/BoundedAcousticCaptionStrategy';
export * from './subtitles/captions-canvas';
export * from './overlay-effects/simulators/DeterministicParticleField';
export * from './overlay-effects/simulators/PostProcessingShaders';
export * from './styles/ColorGradingEngine';
export * from './depth3d/strategy';
export * from './depth3d/renderers';
export * from './depth3d/factory';
export * from './depth3d/frame-breaker';
export * from './types';