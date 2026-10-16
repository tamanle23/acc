/**
 * ProceduralAudioSynthesizer:
 * Pure TypeScript DSP synthesizer generating high-fidelity Float32Array PCM audio samples.
 * Zero DOM or platform dependencies - runs identically in Browser (Web Audio) and Node/Bun server.
 */
export class ProceduralAudioSynthesizer {
  /**
   * Generates ambient sci-fi cyberpunk synthwave drone and chord pads.
   */
  public static synthBGM(
    timeOffsetSec: number,
    durationSec: number,
    sampleRate = 44100
  ): Float32Array {
    const numSamples = Math.floor(durationSec * sampleRate);
    const buffer = new Float32Array(numSamples);

    // Fundamental chords: D minor / F major sci-fi drone (D2=73.42Hz, A2=110Hz, F3=174.61Hz)
    const f1 = 73.42;
    const f2 = 110.0;
    const f3 = 174.61;

    for (let i = 0; i < numSamples; i++) {
      const t = timeOffsetSec + i / sampleRate;

      // Slow LFO for filter sweep
      const lfo = 0.5 + 0.5 * Math.sin(t * 0.4);

      // Sub-bass drone + chord harmonics
      const osc1 = Math.sin(2 * Math.PI * f1 * t);
      const osc2 = 0.6 * Math.sin(2 * Math.PI * f2 * t + 0.3);
      const osc3 = 0.4 * Math.sin(2 * Math.PI * f3 * t * (1.0 + 0.005 * Math.sin(t * 3.0)));

      // Subtle detuned saw shimmer
      const sawPhase = (t * f1 * 2) % 1.0;
      const saw = (sawPhase * 2.0 - 1.0) * 0.15 * lfo;

      // Master BGM sample with soft compression
      const raw = (osc1 * 0.5 + osc2 * 0.3 + osc3 * 0.2 + saw) * 0.35;
      buffer[i] = Math.tanh(raw); // soft clip analog saturation
    }

    return buffer;
  }

  /**
   * Generates a frequency-swept laser blast / plasma cannon SFX.
   */
  public static synthLaserSFX(
    timeOffsetSec: number,
    durationSec: number,
    sampleRate = 44100
  ): Float32Array {
    const numSamples = Math.floor(durationSec * sampleRate);
    const buffer = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = timeOffsetSec + i / sampleRate;
      const localT = t % 1.5; // loop burst every 1.5s if long

      if (localT > 0.4) {
        buffer[i] = 0;
        continue;
      }

      // Exponential pitch drop from 2400Hz down to 120Hz
      const decay = Math.exp(-localT * 12.0);
      const freq = 120.0 + 2280.0 * Math.exp(-localT * 25.0);
      const osc = Math.sin(2 * Math.PI * freq * localT);

      // White noise transient pop at impact start
      const noise = (Math.random() * 2.0 - 1.0) * Math.exp(-localT * 50.0) * 0.3;

      buffer[i] = (osc + noise) * decay * 0.7;
    }

    return buffer;
  }

  /**
   * Generates a vocoded pilot radio chatter / cockpit telemetry speech pattern.
   * Uses simulated vocal tract formant filter bands (F1 ~ 700Hz, F2 ~ 1220Hz, F3 ~ 2600Hz)
   * modulated with a pseudo-speech cadence and carrier radio static.
   */
  public static synthPilotVoice(
    timeOffsetSec: number,
    durationSec: number,
    sampleRate = 44100
  ): Float32Array {
    const numSamples = Math.floor(durationSec * sampleRate);
    const buffer = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = timeOffsetSec + i / sampleRate;

      // Speech syllabic cadence envelope (syllables per second ~ 4Hz)
      const speechEnvelope = Math.max(0, Math.sin(t * Math.PI * 4.5)) * Math.max(0, Math.sin(t * 1.2));

      // Carrier buzz (pulse train representing vocal cords)
      const pitch = 140.0 + 20.0 * Math.sin(t * 2.5); // intonation inflection
      const phase = (t * pitch) % 1.0;
      const glottalPulse = phase < 0.2 ? Math.sin((phase / 0.2) * Math.PI) : 0;

      // Formants
      const f1 = Math.sin(2 * Math.PI * 750 * t) * 0.5;
      const f2 = Math.sin(2 * Math.PI * 1350 * t) * 0.35;
      const f3 = Math.sin(2 * Math.PI * 2400 * t) * 0.15;
      const formantBody = (f1 + f2 + f3) * glottalPulse;

      // Military radio bandpass noise & squelch
      const radioNoise = (Math.random() * 2.0 - 1.0) * 0.08;

      const raw = (formantBody * speechEnvelope * 0.8 + radioNoise * 0.15);
      buffer[i] = Math.tanh(raw * 1.5) * 0.6;
    }

    return buffer;
  }

  /**
   * Generates a deep sub-bass starship engine hum.
   */
  public static synthEngineHum(
    timeOffsetSec: number,
    durationSec: number,
    sampleRate = 44100
  ): Float32Array {
    const numSamples = Math.floor(durationSec * sampleRate);
    const buffer = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = timeOffsetSec + i / sampleRate;
      const sub = Math.sin(2 * Math.PI * 45.0 * t) * 0.5;
      const rumble = Math.sin(2 * Math.PI * 90.0 * t + Math.sin(t * 1.5)) * 0.25;
      const flutter = Math.sin(2 * Math.PI * 135.0 * t) * 0.1;

      buffer[i] = (sub + rumble + flutter) * 0.4;
    }

    return buffer;
  }
}
