import {
  MediaEngineRegistry,
  type MediaEngineType,
  type SinkInitMetadata,
} from '@acc/core';
import type { IIRFrameSink } from './IIRFrameSink';

export class MediaSinkFactory {
  public static createVideoSink(engineType?: MediaEngineType, meta?: SinkInitMetadata): IIRFrameSink {
    const strategy = MediaEngineRegistry.get(engineType);
    return strategy.createVideoSink(meta) as IIRFrameSink;
  }
}
