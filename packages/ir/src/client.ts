/**
 * Universal Video IR Client Exports (@acc/ir/client)
 * Pure isomorphic exports for browser runtimes (Vite / React 19).
 * Strictly guarantees ZERO Node/FFI/native C dependencies (@napi-rs/canvas, fs, child_process).
 */

// Universal Video IR V1.0-Stable Types
export * from './types/VideoIR';
export * from './types/FineGrainedVideoDirectorConfig';
export * from './schema/VideoIRSchemaValidator';
export * from './prober/AssetMetadataProber';
export * from './compiler/DeterministicAudioClock';
export * from './compiler/IntervalTreeIndex';
export * from './compiler/RelationalDAGCompiler';

// Platform-Independent Audio Core
export * from './renderer/audio/ProceduralAudioSynthesizer';
export * from './renderer/audio/AudioSourceAdapter';
export * from './renderer/audio/DynamicAudioDuckingEngine';
export * from './renderer/audio/UniversalAudioMixer';

// Pure Buffer-Based Audio Plugins
export * from './plugins/audio/VolumeModifierPlugin';
export * from './plugins/audio/PanModifierPlugin';
export * from './plugins/audio/FilterModifierPlugin';
export * from './plugins/audio/PitchModifierPlugin';
export * from './plugins/sfx/DynamicDuckingPlugin';
export { ModifierPluginRegistry, type ModifierPlugin, type ModifierContext } from './plugins/ModifierPluginRegistry';
