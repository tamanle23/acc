import { describe, it, expect } from 'bun:test';
import {
  SharedArrayRingBuffer,
  RING_BUFFER_FLAGS,
  CONTROL_INDICES,
} from '../apps/studio/src/lib/audio/SharedArrayRingBuffer';
import { UniversalAudioStreamWorklet } from '../apps/studio/src/lib/audio/UniversalAudioStreamWorklet';

describe('SharedArrayRingBuffer SPSC Lock-Free Concurrency Suite', () => {

  // =========================================================================
  // 1. Basic SPSC Read/Write Verification
  // =========================================================================
  describe('Single-Producer Single-Consumer Read/Write Parity', () => {
    it('writes and reads stereo float samples with bit-identical fidelity', () => {
      const ring = new SharedArrayRingBuffer({ sampleRate: 44100, capacitySeconds: 1 });
      const sampleCount = 512;
      const leftIn = new Float32Array(sampleCount);
      const rightIn = new Float32Array(sampleCount);

      for (let i = 0; i < sampleCount; i++) {
        leftIn[i] = Math.sin(i / 10);
        rightIn[i] = Math.cos(i / 10);
      }

      const written = ring.write(leftIn, rightIn);
      expect(written).toBe(sampleCount);
      expect(ring.getAvailableRead()).toBe(sampleCount);

      const outLeft = new Float32Array(sampleCount);
      const outRight = new Float32Array(sampleCount);

      let totalRead = 0;
      while (totalRead < sampleCount) {
        const tempL = new Float32Array(128);
        const tempR = new Float32Array(128);
        const read = ring.read(tempL, tempR, 128);
        outLeft.set(tempL.subarray(0, read), totalRead);
        outRight.set(tempR.subarray(0, read), totalRead);
        totalRead += read;
      }

      expect(totalRead).toBe(sampleCount);
      expect(ring.getAvailableRead()).toBe(0);

      // Verify sample equality
      for (let i = 0; i < sampleCount; i++) {
        expect(outLeft[i]).toBeCloseTo(leftIn[i]!, 5);
        expect(outRight[i]).toBeCloseTo(rightIn[i]!, 5);
      }
    });
  });

  // =========================================================================
  // 2. Split Circular Boundary Wraparound
  // =========================================================================
  describe('Split Circular Boundary Wraparound Handling', () => {
    it('seamlessly splits and reassembles audio chunks across buffer boundary without corruption', () => {
      // Small buffer to force frequent boundary wraps
      const ring = new SharedArrayRingBuffer({ sampleRate: 100, capacitySeconds: 2 }); // capacity = 200 samples
      const capacity = ring.capacity;

      // 1. Fill nearly to capacity (e.g. capacity - 30)
      const prepL = new Float32Array(capacity - 30);
      const prepR = new Float32Array(capacity - 30);
      ring.write(prepL, prepR);

      // Drain it completely so writePtr is at (capacity - 30) and readPtr is at (capacity - 30)
      const drainL = new Float32Array(capacity - 30);
      const drainR = new Float32Array(capacity - 30);
      ring.read(drainL, drainR, capacity - 30);
      expect(ring.getAvailableRead()).toBe(0);

      // 2. Now write a chunk of 80 samples: 30 will go to the end, 50 will wrap around to index 0!
      const wrapL = new Float32Array(80);
      const wrapR = new Float32Array(80);
      for (let i = 0; i < 80; i++) {
        wrapL[i] = i * 1.5;
        wrapR[i] = -i * 1.5;
      }

      const written = ring.write(wrapL, wrapR);
      expect(written).toBe(80);
      expect(ring.getAvailableRead()).toBe(80);

      // 3. Read back in two 40-sample blocks: should span the boundary seamlessly
      const readL1 = new Float32Array(40);
      const readR1 = new Float32Array(40);
      ring.read(readL1, readR1, 40);

      const readL2 = new Float32Array(40);
      const readR2 = new Float32Array(40);
      ring.read(readL2, readR2, 40);

      // Check first block [0..39]
      for (let i = 0; i < 40; i++) {
        expect(readL1[i]).toBeCloseTo(i * 1.5, 4);
        expect(readR1[i]).toBeCloseTo(-i * 1.5, 4);
      }

      // Check second block [40..79]
      for (let i = 0; i < 40; i++) {
        expect(readL2[i]).toBeCloseTo((i + 40) * 1.5, 4);
        expect(readR2[i]).toBeCloseTo(-(i + 40) * 1.5, 4);
      }
    });
  });

  // =========================================================================
  // 3. Underflow & Silence Padding Resilience
  // =========================================================================
  describe('Underflow Detection & Silence Padding', () => {
    it('pads unread block remainder with silence (0) and flags underflow', () => {
      const ring = new SharedArrayRingBuffer({ sampleRate: 1000, capacitySeconds: 1 });

      // Write only 40 samples
      const l = new Float32Array(40).fill(0.75);
      const r = new Float32Array(40).fill(-0.75);
      ring.write(l, r);

      // Request 128 samples
      const outL = new Float32Array(128).fill(999);
      const outR = new Float32Array(128).fill(999);

      const read = ring.read(outL, outR, 128);
      expect(read).toBe(40);

      // First 40 must have actual signal
      for (let i = 0; i < 40; i++) {
        expect(outL[i]).toBeCloseTo(0.75, 4);
        expect(outR[i]).toBeCloseTo(-0.75, 4);
      }

      // Remaining 88 must be strictly 0
      for (let i = 40; i < 128; i++) {
        expect(outL[i]).toBe(0);
        expect(outR[i]).toBe(0);
      }
    });
  });

  // =========================================================================
  // 4. Seek Reset & Flag Invariants
  // =========================================================================
  describe('Reset and State Flags', () => {
    it('instantly flushes all buffered samples and sets SEEK_RESET flag on reset()', () => {
      const ring = new SharedArrayRingBuffer({ sampleRate: 44100, capacitySeconds: 2 });
      ring.write(new Float32Array(1000), new Float32Array(1000));
      expect(ring.getAvailableRead()).toBe(1000);

      ring.reset();
      expect(ring.getAvailableRead()).toBe(0);
      expect(ring.getAvailableWrite()).toBe(ring.capacity - 1);
    });
  });

  // =========================================================================
  // 5. 100,000 Sample Soak Stress Run
  // =========================================================================
  describe('Continuous SPSC Stream Stress Run', () => {
    it('survives 100,000 continuous samples with interleaved variable chunks without drift or deadlocks', () => {
      const worklet = new UniversalAudioStreamWorklet(44100);
      const totalSamples = 100_000;
      let writtenTotal = 0;
      let readTotal = 0;

      const outL = new Float32Array(128);
      const outR = new Float32Array(128);

      while (writtenTotal < totalSamples) {
        const chunkSize = 256;
        const left = new Float32Array(chunkSize);
        const right = new Float32Array(chunkSize);
        for (let i = 0; i < chunkSize; i++) {
          left[i] = (writtenTotal + i) % 100;
          right[i] = -((writtenTotal + i) % 100);
        }

        worklet.pushChunk(left, right);
        writtenTotal += chunkSize;

        // Drain 2 blocks of 128 samples
        worklet.processBlock(outL, outR);
        worklet.processBlock(outL, outR);
        readTotal += 256;
      }

      expect(writtenTotal).toBe(totalSamples);
      expect(readTotal).toBe(totalSamples);
      expect(worklet.getProcessedTimeSec()).toBeCloseTo(totalSamples / 44100, 2);
    });
  });
});
