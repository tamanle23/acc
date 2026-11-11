// ============================================================================
// KINETIX STUDIO - DRIVEN PORT: AUDIO ENGINE PORT (ECMA-429)
// Pure architectural interface decoupling audio synthesis, Web Audio API,
// AudioWorklet clocks, and telemetry analysis from core studio orchestration.
// ============================================================================

import type { AudioTelemetry } from '@/types/motion';
import type { StudioState } from '@/types/studio';

export interface IAudioEnginePort {
  readonly isInitialized: boolean;
  initialize(): Promise<boolean>;
  start(timeOffsetSec?: number): void;
  stop(): void;
  setBpm(bpm: number): void;
  getTelemetry(pulseBoost?: number): AudioTelemetry;
  renderOfflineBuffer(state: StudioState): Promise<AudioBuffer | null>;
  renderOfflinePcmChannels(state: StudioState): Promise<{
    channels: Float32Array[];
    sampleRate: number;
    length: number;
    durationSec: number;
  } | null>;
  dispose(): void;
}
