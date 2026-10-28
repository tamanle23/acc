/**
 * SpscAudioWorkletProcessor:
 * Dedicated AudioWorkletProcessor script code and registration helper.
 * Executes on the real-time high-priority Web Audio rendering thread every 128 samples (~2.9ms).
 * Reads directly from SharedArrayRingBuffer via Atomics, guaranteeing zero GC pauses and zero glitching.
 */

export const SPSC_WORKLET_NAME = 'spsc-audio-worklet-processor';

export const SPSC_WORKLET_SOURCE = `
class SpscAudioWorkletProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sharedBuffer = options?.processorOptions?.sharedBuffer;
    if (this.sharedBuffer) {
      this.control = new Int32Array(this.sharedBuffer, 0, 16);
      this.capacity = this.control[2]; // CONTROL_INDICES.CAPACITY
      this.leftChannel = new Float32Array(this.sharedBuffer, 64, this.capacity);
      this.rightChannel = new Float32Array(this.sharedBuffer, 64 + this.capacity * 4, this.capacity);
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length < 2 || !this.sharedBuffer) {
      return true;
    }

    const outLeft = output[0];
    const outRight = output[1];
    const blockSize = outLeft.length; // 128

    const readPtr = Atomics.load(this.control, 0); // READ_PTR
    const writePtr = Atomics.load(this.control, 1); // WRITE_PTR
    const available = (writePtr - readPtr + this.capacity) % this.capacity;

    const toRead = Math.min(blockSize, available);

    if (toRead > 0) {
      const slice1 = Math.min(toRead, this.capacity - readPtr);
      const slice2 = toRead - slice1;

      // Slice 1
      outLeft.set(this.leftChannel.subarray(readPtr, readPtr + slice1), 0);
      outRight.set(this.rightChannel.subarray(readPtr, readPtr + slice1), 0);

      // Slice 2 if wrapped
      if (slice2 > 0) {
        outLeft.set(this.leftChannel.subarray(0, slice2), slice1);
        outRight.set(this.rightChannel.subarray(0, slice2), slice1);
      }

      const nextReadPtr = (readPtr + toRead) % this.capacity;
      Atomics.store(this.control, 0, nextReadPtr);
    }

    // Fill underrun with silence
    for (let i = toRead; i < blockSize; i++) {
      outLeft[i] = 0;
      outRight[i] = 0;
    }

    return true;
  }
}

registerProcessor('${SPSC_WORKLET_NAME}', SpscAudioWorkletProcessor);
`;

const registeredContexts = new WeakSet<AudioContext>();

/**
 * Registers the SPSC AudioWorklet processor module into an AudioContext.
 * Idempotent across multiple calls on the same context.
 */
export async function registerSpscAudioWorklet(ctx: AudioContext): Promise<boolean> {
  if (registeredContexts.has(ctx)) {
    return true;
  }

  if (!ctx.audioWorklet || typeof ctx.audioWorklet.addModule !== 'function') {
    return false;
  }

  try {
    const blob = new Blob([SPSC_WORKLET_SOURCE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    registeredContexts.add(ctx);
    return true;
  } catch (err) {
    console.warn('[SpscAudioWorkletProcessor] Failed to register audio worklet module:', err);
    return false;
  }
}
