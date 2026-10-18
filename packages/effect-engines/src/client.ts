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
export * from './audio/ProceduralAudioSynthesizer';
export * from './audio/UniversalAudioMixer';
export * from './vision/CameraSplineInterpolator';
export * from './types';
