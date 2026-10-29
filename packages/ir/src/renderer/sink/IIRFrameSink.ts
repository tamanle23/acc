import type {
  IMediaFrameSink,
  SinkInitMetadata as CoreSinkInitMetadata,
  SinkFinalizeResult as CoreSinkFinalizeResult,
  MediaAudioMixResult,
} from '@acc/core-isomorphic';
import type { DecoupledAudioMixResult } from '../../server/DecoupledAudioMixer';

export type SinkInitMetadata = CoreSinkInitMetadata;
export type SinkFinalizeResult = CoreSinkFinalizeResult;

/**
 * IIRFrameSink:
 * Decoupled consumer interface for rasterized video frames and audio mixdown.
 * Compatible with core IMediaFrameSink.
 */
export interface IIRFrameSink extends IMediaFrameSink {
  finalize(audioResult?: DecoupledAudioMixResult | MediaAudioMixResult): Promise<SinkFinalizeResult>;
}
