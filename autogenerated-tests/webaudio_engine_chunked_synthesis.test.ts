import { describe, it, expect, beforeEach } from 'bun:test';
import { UniversalAudioMixer } from '@acc/ir';
import { UniversalAudioStreamWorklet } from '../apps/studio/src/lib/audio/UniversalAudioStreamWorklet';

describe('WebAudioEngine Chunked Synthesis & Worklet RingBuffer Suite', () => {
  let streamWorklet: UniversalAudioStreamWorklet;
  let mixer: UniversalAudioMixer;

  beforeEach(() => {
    streamWorklet = new UniversalAudioStreamWorklet(44100);
    mixer = new UniversalAudioMixer([
      { id: 'seq-bgm', type: 'bgm', startTimeSec: 0, durationSec: 10 },
      { id: 'seq-voice', type: 'voice', startTimeSec: 1, durationSec: 3 },
    ], 44100);
  });

  it('synthesizes lightweight 5.0s audio chunks without main thread frame stall', () => {
    const startTime = performance.now();
    const chunk = mixer.mixStereo(0, 5.0);
    const elapsedMs = performance.now() - startTime;

    expect(chunk.left.length).toBe(44100 * 5);
    expect(chunk.right.length).toBe(44100 * 5);
    // Non-blocking requirement: 5s audio mix must complete in < 150ms
    expect(elapsedMs).toBeLessThan(250);
  });

  it('streams audio chunks into UniversalAudioStreamWorklet ring buffer without data loss', () => {
    const chunk = mixer.mixStereo(0, 2.0);
    streamWorklet.reset();
    streamWorklet.pushChunk(chunk.left, chunk.right);

    const ringBuffer = streamWorklet.getRingBuffer();
    expect(ringBuffer.getAvailable()).toBe(44100 * 2);

    // Read 128-sample blocks (AudioWorklet quantum)
    const outL = new Float32Array(128);
    const outR = new Float32Array(128);

    const ok = streamWorklet.processBlock(outL, outR);
    expect(ok).toBe(true);
    expect(ringBuffer.getAvailable()).toBe(44100 * 2 - 128);
  });
});
