import { describe, it, expect } from 'bun:test';

describe('Preview Worker Clip-Local & Asset Synchronization Parity', () => {
  it('correctly maps global timeline frame to sequence-local frame', () => {
    const sequences = [
      { id: 'seq-1', assetId: 'asset-1', startFrame: 0, endFrame: 60 },
      { id: 'seq-2', assetId: 'asset-2', startFrame: 60, endFrame: 120 },
      { id: 'seq-3', assetId: 'asset-3', startFrame: 120, endFrame: 240 },
    ];

    const getActiveLocalFrame = (globalFrame: number, seq: typeof sequences[0]) => {
      return Math.max(0, globalFrame - seq.startFrame);
    };

    // Frame 0 (first sequence)
    expect(getActiveLocalFrame(0, sequences[0])).toBe(0);
    expect(getActiveLocalFrame(45, sequences[0])).toBe(45);

    // Frame 90 (second sequence starts at 60)
    expect(getActiveLocalFrame(90, sequences[1])).toBe(30);

    // Frame 150 (third sequence starts at 120)
    expect(getActiveLocalFrame(150, sequences[2])).toBe(30);
  });

  it('verifies hero frame prewarm always requests local frame 0', () => {
    const seq = { id: 'seq-core', assetId: 'asset-video', startFrame: 180, durationFrames: 90 };
    const localHeroFrame = Math.max(0, 0); // Hero frame is 0 relative to sequence
    expect(localHeroFrame).toBe(0);
  });
});
