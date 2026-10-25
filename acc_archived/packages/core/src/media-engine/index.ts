export * from '@acc/core-isomorphic';
export * from './sinks/FFIVideoEncoderSink';
export * from './sinks/FluentPipeVideoSink';
export * from './sinks/MediabunnyServerSink';
export * from './strategies/BunFFIEngineStrategy';
export * from './strategies/FluentFFmpegEngineStrategy';
export * from './strategies/MediabunnyServerStrategy';

import { MediaEngineRegistry } from '@acc/core-isomorphic';
import { BunFFIEngineStrategy } from './strategies/BunFFIEngineStrategy';
import { FluentFFmpegEngineStrategy } from './strategies/FluentFFmpegEngineStrategy';
import { MediabunnyServerStrategy } from './strategies/MediabunnyServerStrategy';

// Automatically register native & server strategies
MediaEngineRegistry.register(new BunFFIEngineStrategy());
MediaEngineRegistry.register(new FluentFFmpegEngineStrategy());
MediaEngineRegistry.register(new MediabunnyServerStrategy());
