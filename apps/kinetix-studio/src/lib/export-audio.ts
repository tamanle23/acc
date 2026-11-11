// ============================================================================
// KINETIX STUDIO - DETERMINISTIC AUDIO EXPORT RESOLVER (ECMA-429)
// Resolves audio buffer for video renders: user audio file or offline analog synth.
// ============================================================================

import type { StudioState } from '@/types/studio';
import { userAudioTrack } from '@/engine/audio-user-track';
import { AnalogAudioSynth } from '@/engine/audio-synth';

/**
 * Deterministically resolves the audio buffer for video export.
 * If user audio exists, it takes precedence. Otherwise, the studio analog synth
 * renders the poster's audio pattern with sample accuracy.
 */
export async function resolveExportAudioBuffer(state: StudioState): Promise<AudioBuffer | null> {
  // 1. User-uploaded audio track priority
  if (state.audioSource === 'user-file') {
    const userBuf = userAudioTrack.getAudioBuffer();
    if (userBuf) return userBuf;
  }

  // 2. Always synthesize the studio analog audio pattern for video exports
  try {
    const synth = new AnalogAudioSynth();
    const bpm = Math.max(30, state.bpm || 120);
    const durationSec = Math.max(1, state.durationSec || 6);
    const volume =
      typeof state.synthMasterVolume === 'number' && state.synthMasterVolume > 0
        ? state.synthMasterVolume
        : 0.7;
    const pattern = state.synthPattern || 'techno-4-on-floor';
    const cutoff = state.synthFilterCutoff || 4200;
    const resonance = state.synthFilterResonance || 3.5;

    return await synth.renderAudioTrackOffline({
      bpm,
      durationSec,
      pattern,
      volume,
      cutoff,
      resonance,
      mutes: state.synthVoiceMutes,
    });
  } catch (err) {
    console.warn('Could not render offline synth audio for export:', err);
    return null;
  }
}
