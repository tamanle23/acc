import { describe, it, expect } from 'bun:test';
import crypto from 'crypto';
import { TimeSpaceRegistry } from '@acc/core-isomorphic';

describe('TimeSpace Chunk Boundary Parity Suite', () => {
  it('guarantees 100% cryptographic SHA-256 byte parity across chunk boundaries without temporal seams', () => {
    // Instantiate machine from registry
    const machineSequential = TimeSpaceRegistry.instantiate('callout_leader', {
      targetX: 0.1,
      targetY: -0.2,
      text: 'CHUNK_PARITY',
    });

    const machineChunked = TimeSpaceRegistry.instantiate('callout_leader', {
      targetX: 0.1,
      targetY: -0.2,
      text: 'CHUNK_PARITY',
    });

    const fps = 30;
    const viewport = { width: 1920, height: 1080 };
    const seed = 8888;

    // Run 1: Sequential render up to frame 150 (simulating monolithic render)
    let sequentialSnapshotAt150: any = null;
    for (let f = 0; f <= 150; f++) {
      const snap = machineSequential.seek(f, fps, seed, viewport);
      if (f === 150) {
        sequentialSnapshotAt150 = snap;
      }
    }

    // Run 2: Direct jump to frame 150 (simulating Worker 2 rendering chunk 1: frames 150-299)
    const chunkSnapshotAt150 = machineChunked.seek(150, fps, seed, viewport);

    expect(sequentialSnapshotAt150).not.toBeNull();
    expect(chunkSnapshotAt150).not.toBeNull();

    // Verify numerical state parity
    expect(sequentialSnapshotAt150.phase).toBe(chunkSnapshotAt150.phase);
    expect(sequentialSnapshotAt150.globalTimeSec).toBe(chunkSnapshotAt150.globalTimeSec);
    expect(sequentialSnapshotAt150.localTimeSec).toBe(chunkSnapshotAt150.localTimeSec);
    expect(sequentialSnapshotAt150.state).toEqual(chunkSnapshotAt150.state);

    // Verify cryptographic SHA-256 buffer parity
    const seqBuf = Buffer.from(sequentialSnapshotAt150.buffers.positions.buffer);
    const chunkBuf = Buffer.from(chunkSnapshotAt150.buffers.positions.buffer);

    const hashSeq = crypto.createHash('sha256').update(seqBuf).digest('hex');
    const hashChunk = crypto.createHash('sha256').update(chunkBuf).digest('hex');

    expect(hashSeq).toBe(hashChunk);
  });
});
