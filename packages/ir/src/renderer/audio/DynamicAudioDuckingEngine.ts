export interface DynamicDuckingConfig {
  sampleRate: number;
  channels: number;
  attenuationDb?: number; // e.g. -18 dB (target ducking gain)
  thresholdDb?: number;   // e.g. -36 dB (voice detection threshold)
  attackMs?: number;      // e.g. 15 ms (ramp down)
  holdMs?: number;        // e.g. 100 ms (hold between words)
  releaseMs?: number;     // e.g. 300 ms (smooth logarithmic return)
}

/**
 * DynamicAudioDuckingEngine:
 * Computes an exact per-sample gain envelope curve from dialogue / voiceover PCM.
 * Broadcast-standard Attack -> Hold -> Release state machine:
 * - Attack: Exponential ramp down when dialogue energy exceeds threshold.
 * - Hold: Maintains attenuation across brief inter-word pauses.
 * - Release: Smooth logarithmic recovery back to 0 dB unity gain.
 */
export class DynamicAudioDuckingEngine {
  /**
   * Generates a contiguous Float32Array containing a [0.0, 1.0] multiplier for every sample
   * across totalSamples matching the timeline duration.
   */
  public static generateEnvelope(
    voicePcm: Float32Array,
    totalSamples: number,
    config: DynamicDuckingConfig
  ): Float32Array {
    const {
      sampleRate,
      channels,
      attenuationDb = -18.0,
      thresholdDb = -36.0,
      attackMs = 15,
      holdMs = 100,
      releaseMs = 300,
    } = config;

    const envelope = new Float32Array(totalSamples);
    envelope.fill(1.0); // Default to full unity gain

    if (!voicePcm || voicePcm.length === 0 || totalSamples === 0) {
      return envelope;
    }

    const minGain = Math.pow(10, attenuationDb / 20); // e.g. -18 dB ≈ 0.12589
    const thresholdLinear = Math.pow(10, thresholdDb / 20); // e.g. -36 dB ≈ 0.0158

    const attackCoeff = Math.exp(-1.0 / ((attackMs / 1000) * sampleRate));
    const releaseCoeff = Math.exp(-1.0 / ((releaseMs / 1000) * sampleRate));
    const holdSamples = Math.round((holdMs / 1000) * sampleRate);

    let currentGain = 1.0;
    let holdCounter = 0;

    const voiceSamplesCount = Math.floor(voicePcm.length / channels);

    for (let s = 0; s < totalSamples; s++) {
      let voiceEnergy = 0.0;
      if (s < voiceSamplesCount) {
        if (channels === 1) {
          voiceEnergy = Math.abs(voicePcm[s]);
        } else {
          // Max absolute amplitude across channels
          const idx = s * channels;
          voiceEnergy = Math.max(Math.abs(voicePcm[idx]), Math.abs(voicePcm[idx + 1]));
        }
      }

      if (voiceEnergy > thresholdLinear) {
        // Dialogue active: attack ramp down to minGain
        currentGain = minGain + attackCoeff * (currentGain - minGain);
        holdCounter = holdSamples;
      } else if (holdCounter > 0) {
        // Hold period: keep current attenuated gain
        holdCounter--;
      } else {
        // Release phase: logarithmic return to unity gain (1.0)
        currentGain = 1.0 + releaseCoeff * (currentGain - 1.0);
      }

      envelope[s] = Math.min(1.0, Math.max(minGain, currentGain));
    }

    return envelope;
  }
}
