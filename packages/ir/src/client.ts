/**
 * Browser-Safe Video IR Client Exports (@acc/ir/client)
 * Exports in-memory browser video frame sinks (MediabunnyClientSink, PreviewCanvasSink)
 * and client-compatible sink contracts without Node FFI, child_process, or server worker pools.
 */

export * from './renderer/sink/IIRFrameSink';
export * from './renderer/sink/PreviewCanvasSink';
export * from './renderer/sink/MediabunnyClientSink';
export * from './renderer/preview/IRPreviewEngine';
export * from './renderer/preview/AssetTextureCache';
export * from './renderer/preview/DeterministicMotionEvaluator';
export * from './plugins';
