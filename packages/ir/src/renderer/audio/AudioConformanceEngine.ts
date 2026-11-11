/**
 * AudioConformanceEngine:
 * High-fidelity multichannel audio conformance and anti-aliased resampling engine.
 * Adheres strictly to:
 * - ITU-R BS.775-1 multichannel stereo downmixing with -3dB acoustic power conservation.
 * - Band-limited Kaiser-windowed Sinc interpolation with dynamic Nyquist cutoff scaling (omega_c).
 * - Unity DC gain normalization preventing amplitude ripple.
 */
export class AudioConformanceEngine {
  public static readonly ATTENUATION_3DB = 0.7071067811865476; // 1 / sqrt(2)

  /**
   * Conforms arbitrary multichannel PCM layouts (Mono, 5.1 Surround, Stereo)
   * into canonical 2-channel stereo Float32Array buffers.
   */
  public static conformChannels(channels: Float32Array[]): [Float32Array, Float32Array] {
    if (!channels || channels.length === 0 || !channels[0] || channels[0].length === 0) {
      return [new Float32Array(0), new Float32Array(0)];
    }

    // 1. Mono Source -> Stereo (Center panned with -3 dB constant power law)
    if (channels.length === 1) {
      const mono = channels[0];
      const len = mono.length;
      const left = new Float32Array(len);
      const right = new Float32Array(len);
      const coeff = AudioConformanceEngine.ATTENUATION_3DB;

      for (let i = 0; i < len; i++) {
        const v = mono[i] * coeff;
        left[i] = v;
        right[i] = v;
      }
      return [left, right];
    }

    // 2. 5.1 Surround Source -> Stereo (ITU-R BS.775-1 Downmixing Matrix)
    // Channel ordering: [Left, Right, Center, LFE, LeftSurround, RightSurround]
    if (channels.length >= 6) {
      const lf = channels[0];
      const rf = channels[1];
      const c = channels[2];
      // _lfe = channels[3]; // Excluded by default per ITU-R BS.775 to protect stereo speakers
      const ls = channels[4];
      const rs = channels[5];

      const len = Math.min(lf.length, rf.length, c.length, ls.length, rs.length);
      const left = new Float32Array(len);
      const right = new Float32Array(len);
      const coeff = AudioConformanceEngine.ATTENUATION_3DB;

      for (let i = 0; i < len; i++) {
        left[i] = lf[i] + coeff * (c[i] + ls[i]);
        right[i] = rf[i] + coeff * (c[i] + rs[i]);
      }
      return [left, right];
    }

    // 3. Stereo Passthrough (or >= 2 channels: extract L and R)
    return [channels[0], channels[1] ?? channels[0]];
  }

  /**
   * Zeroth-order modified Bessel function of the first kind I0(u).
   * Computed via power series expansion, converging rapidly within 25 terms.
   */
  public static besselI0(u: number): number {
    let sum = 1.0;
    let term = 1.0;
    const halfU = u * 0.5;

    for (let k = 1; k <= 25; k++) {
      term *= (halfU / k) * (halfU / k);
      sum += term;
      if (term < 1e-12 * sum) break;
    }
    return sum;
  }

  /**
   * Band-limited Kaiser-windowed Sinc Resampler with Anti-Aliasing Cutoff.
   *
   * @param input Raw Float32Array PCM samples
   * @param sourceRate Original sample rate (e.g. 96000 or 44100)
   * @param targetRate Target sample rate (e.g. 48000)
   * @param nominalRadius Nominal filter half-width in taps (defaults to 16 taps)
   * @param beta Kaiser window shape parameter (defaults to 5.0 for > 50 dB stopband attenuation)
   */
  public static resampleKaiserSinc(
    input: Float32Array,
    sourceRate: number,
    targetRate: number,
    nominalRadius = 16,
    beta = 5.0
  ): Float32Array {
    if (!input || input.length === 0) {
      return new Float32Array(0);
    }
    if (sourceRate <= 0 || targetRate <= 0 || sourceRate === targetRate) {
      return input.slice();
    }

    const ratio = targetRate / sourceRate;
    const outLength = Math.max(1, Math.round(input.length * ratio));
    const output = new Float32Array(outLength);

    // Anti-aliasing cutoff frequency: scaled when downsampling (ratio < 1)
    const cutoff = Math.min(1.0, ratio);
    const filterRadius = Math.ceil(nominalRadius / cutoff);
    const i0Beta = AudioConformanceEngine.besselI0(beta);

    for (let i = 0; i < outLength; i++) {
      const srcPos = i / ratio;
      const center = Math.floor(srcPos);
      let acc = 0;
      let weightSum = 0;

      const minTap = Math.max(-filterRadius, -center);
      const maxTap = Math.min(filterRadius, input.length - 1 - center);

      for (let tap = minTap; tap <= maxTap; tap++) {
        const idx = center + tap;
        const delta = srcPos - idx;
        const x = delta * cutoff;

        // Band-limited Sinc
        const sinc = x === 0 ? 1.0 : Math.sin(Math.PI * x) / (Math.PI * x);

        // Kaiser Window
        const frac = delta / filterRadius;
        const wArg = 1.0 - frac * frac;
        const w = wArg > 0 ? AudioConformanceEngine.besselI0(beta * Math.sqrt(wArg)) / i0Beta : 0;

        const weight = sinc * w * cutoff;
        acc += input[idx] * weight;
        weightSum += weight;
      }

      output[i] = weightSum > 1e-9 ? acc / weightSum : 0;
    }

    return output;
  }

  /**
   * Resamples stereo Float32Array channel pair from sourceRate to targetRate.
   */
  public static resampleStereo(
    left: Float32Array,
    right: Float32Array,
    sourceRate: number,
    targetRate: number,
    nominalRadius = 16,
    beta = 5.0
  ): [Float32Array, Float32Array] {
    return [
      AudioConformanceEngine.resampleKaiserSinc(left, sourceRate, targetRate, nominalRadius, beta),
      AudioConformanceEngine.resampleKaiserSinc(right, sourceRate, targetRate, nominalRadius, beta),
    ];
  }
}
