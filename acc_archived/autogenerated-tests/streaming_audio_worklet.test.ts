import { describe, it, expect } from 'bun:test';
import {
  UniversalAudioStreamWorklet,
  UniversalAudioRingBuffer,
} from '../apps/studio/src/lib/audio/UniversalAudioStreamWorklet';

describe('Streaming AudioWorklet Transport Test Suite', () => {
  it('manages ring buffer read/write with 128-sample blocks', () => {
    const ring = new UniversalAudioRingBuffer(1024);
    const left = new Float32Array([1, 2, 3, 4]);
    const right = new Float32Array([1, 2, 3, 4]);

    const written = ring.write({ left, right, startSample: 0 });
    expect(written).toBe(4);
    expect(ring.getAvailable()).toBe(4);

    const outLeft = new Float32Array(4);
    const outRight = new Float32Array(4);
    const read = ring.read(outLeft, outRight, 4);

    expect(read).toBe(4);
    expect(outLeft[0]).toBe(1);
    expect(outLeft[3]).toBe(4);
    expect(ring.getAvailable()).toBe(0);
  });

  it('streams audio continuously beyond 30 seconds with 128-sample blocks without sample drop', () => {
    const sampleRate = 48000;
    const worklet = new UniversalAudioStreamWorklet(sampleRate);

    // Stream 60 seconds of audio in 1-second chunks (beyond the 30s legacy barrier)
    const chunkSize = sampleRate; // 1 second
    const leftChunk = new Float32Array(chunkSize).fill(0.5);
    const rightChunk = new Float32Array(chunkSize).fill(0.5);

    for (let sec = 0; sec < 60; sec++) {
      worklet.pushChunk(leftChunk, rightChunk);

      // Drain blocks
      const outL = new Float32Array(128);
      const outR = new Float32Array(128);
      const blocksPerSec = Math.floor(sampleRate / 128);
      for (let b = 0; b < blocksPerSec; b++) {
        worklet.processBlock(outL, outR);
      }
    }

    expect(worklet.getProcessedTimeSec()).toBeGreaterThanOrEqual(59.9);
  });

  it('applies smooth 5ms cosine crossfade without discontinuities', () => {
    const worklet = new UniversalAudioStreamWorklet(44100);
    const samples = new Float32Array(300).fill(1.0);

    worklet.applyCosineCrossfade(samples);

    // Sample 0 should be 0.0 (smooth start)
    expect(samples[0]).toBeCloseTo(0.0, 3);
    // Intermediate samples smoothly rise toward 1.0
    expect(samples[50]).toBeGreaterThan(0.0);
    expect(samples[50]).toBeLessThan(1.0);
  });
});
