/**
 * @acc/effect-engines/client:
 * Pure browser-safe client exports for Apps/Studio and WebGL environments.
 * Strictly guarantees ZERO native C/Node.js dependencies (.node binaries, @napi-rs/canvas, fs).
 */

export * from './canvas/UniversalCanvasEngine';
export * from './canvas/CanvasTransformOverlay';
export * from './audio/ProceduralAudioSynthesizer';
export * from './audio/UniversalAudioMixer';
export * from './vision/CameraSplineInterpolator';
export * from './types';
