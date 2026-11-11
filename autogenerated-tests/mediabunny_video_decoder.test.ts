import { describe, it, expect } from 'bun:test';
import { MediabunnyVideoDecoder, MediabunnyServerStrategy } from '../packages/core/src/media-engine/strategies/MediabunnyServerStrategy';
import type { IVideoDecoder } from '@acc/core-isomorphic';

describe('MediabunnyVideoDecoder & Strategy Parity', () => {
  it('instantiates MediabunnyVideoDecoder conforming to IVideoDecoder interface', () => {
    const decoder: IVideoDecoder = new MediabunnyVideoDecoder('nonexistent.mp4', 1920, 1080);
    expect(decoder).toBeDefined();
    expect(decoder.width).toBe(1920);
    expect(decoder.height).toBe(1080);
    expect(typeof decoder.open).toBe('function');
    expect(typeof decoder.close).toBe('function');
    expect(typeof decoder.readNextFrame).toBe('function');
    expect(typeof decoder.seekTimestamp).toBe('function');
  });

  it('handles non-existent file gracefully during open()', async () => {
    const decoder = new MediabunnyVideoDecoder('nonexistent_dummy_file.mp4', 1280, 720);
    const result = await decoder.open();
    expect(result).toBe(false);
    expect(await decoder.readNextFrame()).toBeNull();
    expect(await decoder.seekTimestamp?.(5.0)).toBeNull();
    decoder.close();
  });

  it('MediabunnyServerStrategy exposes createVideoDecoder factory with full strategy parity', () => {
    const strategy = new MediabunnyServerStrategy();
    expect(typeof strategy.createVideoDecoder).toBe('function');
    const decoder = strategy.createVideoDecoder('sample.mp4', 1920, 1080);
    expect(decoder).toBeInstanceOf(MediabunnyVideoDecoder);
    expect(decoder.width).toBe(1920);
    expect(decoder.height).toBe(1080);
    expect(typeof decoder.seekTimestamp).toBe('function');
  });
});
