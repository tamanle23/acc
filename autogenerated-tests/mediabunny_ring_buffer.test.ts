import { describe, it, expect } from 'bun:test';
import { MediabunnyWorkerReader } from '../apps/studio/src/workers/MediabunnyWorkerReader';

describe('MediabunnyWorkerReader Decoder Architecture Suite', () => {
  it('initializes with source URI and configurable options', () => {
    const reader = new MediabunnyWorkerReader('test.mp4', { fastScrubFps: 24 });
    expect(reader.src).toBe('test.mp4');
    expect(reader.getIsInitialized()).toBe(false);
  });

  it('provides safe dispose semantics for underlying WebCodecs resources', () => {
    const reader = new MediabunnyWorkerReader('test.mp4');
    expect(() => reader.dispose()).not.toThrow();
    expect(reader.getIsInitialized()).toBe(false);
  });
});
