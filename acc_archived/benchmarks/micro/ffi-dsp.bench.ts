import { run, bench, group } from 'mitata';

group('Audio DSP & Float Operations', () => {
  // Test buffer size: 44100 samples (1 second at 44.1kHz mono)
  const sampleCount = 44100;
  const bufferA = new Float32Array(sampleCount);
  const bufferB = new Float32Array(sampleCount);

  // Pre-fill test buffers
  for (let i = 0; i < sampleCount; i++) {
    bufferA[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
    bufferB[i] = (Math.random() - 0.5) * 0.2;
  }

  bench('Procedural Sine Wave Generation (1s @ 44.1kHz)', () => {
    const out = new Float32Array(sampleCount);
    const freq = 440;
    const sampleRate = 44100;
    const twopi = 2 * Math.PI;
    for (let i = 0; i < sampleCount; i++) {
      out[i] = Math.sin((twopi * freq * i) / sampleRate) * 0.8;
    }
  });

  bench('Sidechain Audio Ducking Gain Scaling (44.1k samples)', () => {
    const output = new Float32Array(sampleCount);
    const targetGain = 0.3;
    const currentGain = 1.0;
    const smoothing = 0.05;

    let gain = currentGain;
    for (let i = 0; i < sampleCount; i++) {
      gain += (targetGain - gain) * smoothing;
      output[i] = bufferA[i] * gain + bufferB[i];
    }
  });

  bench('Audio Peak Normalization & Clipping Protection', () => {
    let peak = 0;
    for (let i = 0; i < sampleCount; i++) {
      const abs = Math.abs(bufferA[i]);
      if (abs > peak) peak = abs;
    }

    const scale = peak > 0 ? 0.98 / peak : 1.0;
    const normalized = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      const val = bufferA[i] * scale;
      normalized[i] = Math.max(-1.0, Math.min(1.0, val));
    }
  });
});

if (import.meta.main) {
  run();
}
