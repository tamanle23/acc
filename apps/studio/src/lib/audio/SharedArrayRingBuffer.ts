/**
 * SharedArrayRingBuffer:
 * High-performance, lock-free Single Producer Single Consumer (SPSC) circular queue
 * backed by SharedArrayBuffer and synchronized via Atomics memory barriers.
 *
 * Guarantees:
 * 1. Zero garbage collection allocations during real-time audio playback.
 * 2. Deterministic split-copy wraparound handling across circular buffer capacity.
 * 3. Strict Acquire/Release memory barrier ordering between Producer and Consumer.
 * 4. Transparent fallback to standard ArrayBuffer if SharedArrayBuffer is unavailable (non-isolated origin).
 */

export interface IAudioStreamTransport {
  write(left: Float32Array, right: Float32Array): number;
  read(outLeft: Float32Array, outRight: Float32Array, blockSize?: number): number;
  reset(): void;
  getAvailableRead(): number;
  getAvailableWrite(): number;
  dispose(): void;
}

export interface SharedArrayRingBufferConfig {
  sampleRate?: number; // default: 44100
  capacitySeconds?: number; // default: 5
}

// Memory Layout:
// [Offset 0..63]: Control Block (Int32Array view, 16 elements = 64 bytes)
//   Index 0: READ_POINTER (Updated by Consumer / AudioWorkletProcessor)
//   Index 1: WRITE_POINTER (Updated by Producer / UniversalAudioMixer)
//   Index 2: CAPACITY_SAMPLES
//   Index 3: STATE_FLAGS (0 = Normal, 1 = Underflow, 2 = Seek Reset)
// [Offset 64 .. 64 + Capacity * 4]: Left Channel (Float32Array)
// [Offset 64 + Capacity * 4 .. 64 + 2 * Capacity * 4]: Right Channel (Float32Array)

export const CONTROL_INDICES = {
  READ_PTR: 0,
  WRITE_PTR: 1,
  CAPACITY: 2,
  FLAGS: 3,
} as const;

export const RING_BUFFER_FLAGS = {
  NORMAL: 0,
  UNDERFLOW: 1,
  SEEK_RESET: 2,
} as const;

export class SharedArrayRingBuffer implements IAudioStreamTransport {
  public readonly isShared: boolean;
  public readonly capacity: number;
  public readonly sampleRate: number;

  private buffer: ArrayBufferLike;
  private control: Int32Array;
  private leftChannel: Float32Array;
  private rightChannel: Float32Array;

  constructor(config: SharedArrayRingBufferConfig = {}) {
    this.sampleRate = config.sampleRate ?? 44100;
    const capacitySeconds = config.capacitySeconds ?? 5;
    this.capacity = Math.max(128, this.sampleRate * capacitySeconds);

    const headerBytes = 64;
    const payloadBytes = this.capacity * 4 * 2; // Stereo Float32
    const totalBytes = headerBytes + payloadBytes;

    // Detect SharedArrayBuffer availability in current realm
    if (typeof SharedArrayBuffer !== 'undefined') {
      try {
        this.buffer = new SharedArrayBuffer(totalBytes);
        this.isShared = true;
      } catch {
        // Fallback if blocked by browser policy
        this.buffer = new ArrayBuffer(totalBytes);
        this.isShared = false;
      }
    } else {
      this.buffer = new ArrayBuffer(totalBytes);
      this.isShared = false;
    }

    this.control = new Int32Array(this.buffer, 0, 16);
    this.leftChannel = new Float32Array(this.buffer, headerBytes, this.capacity);
    this.rightChannel = new Float32Array(this.buffer, headerBytes + this.capacity * 4, this.capacity);

    // Initialize control block
    this.control[CONTROL_INDICES.READ_PTR] = 0;
    this.control[CONTROL_INDICES.WRITE_PTR] = 0;
    this.control[CONTROL_INDICES.CAPACITY] = this.capacity;
    this.control[CONTROL_INDICES.FLAGS] = RING_BUFFER_FLAGS.NORMAL;
  }

  public static isSupported(): boolean {
    return typeof SharedArrayBuffer !== 'undefined' &&
      typeof crossOriginIsolated !== 'undefined' &&
      crossOriginIsolated;
  }

  public getRawBuffer(): ArrayBufferLike {
    return this.buffer;
  }

  /**
   * Producer Write Operation:
   * Writes interleaved or planar stereo samples into circular buffer.
   * Handles split copies when writing across circular boundary.
   * Uses Atomics.store with release semantics on WRITE_PTR.
   */
  public write(left: Float32Array, right: Float32Array): number {
    const toWriteTotal = Math.min(left.length, right.length);
    if (toWriteTotal === 0) return 0;

    const readPtr = this.isShared
      ? Atomics.load(this.control, CONTROL_INDICES.READ_PTR)
      : this.control[CONTROL_INDICES.READ_PTR]!;
    const writePtr = this.isShared
      ? Atomics.load(this.control, CONTROL_INDICES.WRITE_PTR)
      : this.control[CONTROL_INDICES.WRITE_PTR]!;

    // Compute available write space in circular queue (leave 1 slot empty to disambiguate full vs empty)
    const available = (readPtr - writePtr - 1 + this.capacity) % this.capacity;
    const toWrite = Math.min(toWriteTotal, available);
    if (toWrite <= 0) return 0;

    // Split circular boundary copy
    const slice1 = Math.min(toWrite, this.capacity - writePtr);
    const slice2 = toWrite - slice1;

    // 1. Copy first slice: [writePtr .. writePtr + slice1]
    this.leftChannel.set(left.subarray(0, slice1), writePtr);
    this.rightChannel.set(right.subarray(0, slice1), writePtr);

    // 2. Copy second slice: [0 .. slice2] if boundary wrapped
    if (slice2 > 0) {
      this.leftChannel.set(left.subarray(slice1, toWrite), 0);
      this.rightChannel.set(right.subarray(slice1, toWrite), 0);
    }

    const nextWritePtr = (writePtr + toWrite) % this.capacity;

    // Release store: Ensures float sample writes are committed before pointer update is published
    if (this.isShared) {
      Atomics.store(this.control, CONTROL_INDICES.WRITE_PTR, nextWritePtr);
    } else {
      this.control[CONTROL_INDICES.WRITE_PTR] = nextWritePtr;
    }

    return toWrite;
  }

  /**
   * Consumer Read Operation:
   * Reads up to blockSize (default: 128) samples for real-time audio thread.
   * Handles split boundary reads and pads remainder with silence if underflow occurs.
   * Uses Atomics.store with release semantics on READ_PTR.
   */
  public read(outLeft: Float32Array, outRight: Float32Array, blockSize = 128): number {
    const toReadTotal = Math.min(blockSize, outLeft.length, outRight.length);
    if (toReadTotal === 0) return 0;

    const readPtr = this.isShared
      ? Atomics.load(this.control, CONTROL_INDICES.READ_PTR)
      : this.control[CONTROL_INDICES.READ_PTR]!;
    const writePtr = this.isShared
      ? Atomics.load(this.control, CONTROL_INDICES.WRITE_PTR)
      : this.control[CONTROL_INDICES.WRITE_PTR]!;

    // Available unread samples in circular queue
    const available = (writePtr - readPtr + this.capacity) % this.capacity;
    const toRead = Math.min(toReadTotal, available);

    if (toRead < toReadTotal) {
      // Mark underflow flag
      if (this.isShared) {
        Atomics.store(this.control, CONTROL_INDICES.FLAGS, RING_BUFFER_FLAGS.UNDERFLOW);
      } else {
        this.control[CONTROL_INDICES.FLAGS] = RING_BUFFER_FLAGS.UNDERFLOW;
      }
    }

    if (toRead > 0) {
      // Split circular boundary read
      const slice1 = Math.min(toRead, this.capacity - readPtr);
      const slice2 = toRead - slice1;

      // 1. Read first slice
      outLeft.set(this.leftChannel.subarray(readPtr, readPtr + slice1), 0);
      outRight.set(this.rightChannel.subarray(readPtr, readPtr + slice1), 0);

      // 2. Read second slice if boundary wrapped
      if (slice2 > 0) {
        outLeft.set(this.leftChannel.subarray(0, slice2), slice1);
        outRight.set(this.rightChannel.subarray(0, slice2), slice1);
      }

      const nextReadPtr = (readPtr + toRead) % this.capacity;

      // Release store: Updates consumer read pointer
      if (this.isShared) {
        Atomics.store(this.control, CONTROL_INDICES.READ_PTR, nextReadPtr);
      } else {
        this.control[CONTROL_INDICES.READ_PTR] = nextReadPtr;
      }
    }

    // Fill remaining output buffer with silence
    for (let i = toRead; i < toReadTotal; i++) {
      outLeft[i] = 0;
      outRight[i] = 0;
    }

    return toRead;
  }

  public getAvailableRead(): number {
    const readPtr = this.isShared
      ? Atomics.load(this.control, CONTROL_INDICES.READ_PTR)
      : this.control[CONTROL_INDICES.READ_PTR]!;
    const writePtr = this.isShared
      ? Atomics.load(this.control, CONTROL_INDICES.WRITE_PTR)
      : this.control[CONTROL_INDICES.WRITE_PTR]!;

    return (writePtr - readPtr + this.capacity) % this.capacity;
  }

  public getAvailableWrite(): number {
    const readPtr = this.isShared
      ? Atomics.load(this.control, CONTROL_INDICES.READ_PTR)
      : this.control[CONTROL_INDICES.READ_PTR]!;
    const writePtr = this.isShared
      ? Atomics.load(this.control, CONTROL_INDICES.WRITE_PTR)
      : this.control[CONTROL_INDICES.WRITE_PTR]!;

    return (readPtr - writePtr - 1 + this.capacity) % this.capacity;
  }

  public reset(): void {
    if (this.isShared) {
      Atomics.store(this.control, CONTROL_INDICES.FLAGS, RING_BUFFER_FLAGS.SEEK_RESET);
      Atomics.store(this.control, CONTROL_INDICES.READ_PTR, 0);
      Atomics.store(this.control, CONTROL_INDICES.WRITE_PTR, 0);
    } else {
      this.control[CONTROL_INDICES.FLAGS] = RING_BUFFER_FLAGS.SEEK_RESET;
      this.control[CONTROL_INDICES.READ_PTR] = 0;
      this.control[CONTROL_INDICES.WRITE_PTR] = 0;
    }
  }

  public dispose(): void {
    this.reset();
  }
}
