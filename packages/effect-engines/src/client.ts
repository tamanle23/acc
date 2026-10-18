/**
 * @acc/effect-engines/client:
 * Pure browser-safe client exports for Apps/Studio and WebGL environments.
 * Strictly guarantees ZERO native C/Node.js dependencies (.node binaries, @napi-rs/canvas, fs).
 */

export * from './canvas/CanvasTransformOverlay';
export * from './canvas/UniversalCanvasProvider';
export * from './canvas/CanvasAssetLoader';
export * from './canvas/adapters/WebCanvasAdapter';
export * from './canvas/types';
export * from './vision/CameraSplineInterpolator';
export * from './subtitles/SafeZoneManager';
export * from './subtitles/BoundedAcousticCaptionStrategy';
export * from './subtitles/captions-canvas';
export * from './overlay-effects/simulators/DeterministicParticleField';
export * from './overlay-effects/simulators/PostProcessingShaders';
export * from './types';

