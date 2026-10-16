export * from './types';
export * from './MediaEngineRegistry';
export * from './sinks/FFIVideoEncoderSink';
export * from './sinks/FluentPipeVideoSink';
export * from './sinks/MediabunnyServerSink';
export * from './sinks/MediabunnyClientSink';
export * from './strategies/BunFFIEngineStrategy';
export * from './strategies/FluentFFmpegEngineStrategy';
export * from './strategies/MediabunnyServerStrategy';
export * from './strategies/MediabunnyClientStrategy';

import { MediaEngineRegistry } from './MediaEngineRegistry';
import { BunFFIEngineStrategy } from './strategies/BunFFIEngineStrategy';
import { FluentFFmpegEngineStrategy } from './strategies/FluentFFmpegEngineStrategy';
import { MediabunnyServerStrategy } from './strategies/MediabunnyServerStrategy';
import { MediabunnyClientStrategy } from './strategies/MediabunnyClientStrategy';

// Automatically register Phase 1 & Phase 2 strategies
MediaEngineRegistry.register(new BunFFIEngineStrategy());
MediaEngineRegistry.register(new FluentFFmpegEngineStrategy());
MediaEngineRegistry.register(new MediabunnyServerStrategy());
MediaEngineRegistry.register(new MediabunnyClientStrategy());

