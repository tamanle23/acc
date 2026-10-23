import { describe, it, expect, beforeAll } from 'bun:test';
import { FFmpegManager, initFFI, MediaEngineRegistry } from '@acc/core';
import { MediabunnyClientSink } from '@acc/core-web';

describe('Studio React 19 Client-Side Mediabunny Integration', () => {
  beforeAll(async () => {
    await FFmpegManager.prepare();
    initFFI();
    MediaEngineRegistry.get('mediabunny-server').validatePrerequisites();
  });

  it('initializes MediabunnyClientSink without errors', async () => {
    const sink = new MediabunnyClientSink();
    expect(sink.id).toBe('mediabunny-client-sink');
    expect(sink.name).toBe('Mediabunny Client Video Sink');

    await sink.initialize({
      width: 320,
      height: 240,
      fps: 30,
      totalFrames: 30,
      durationSeconds: 1,
    });
  });

  it('consumes frames and finalizes to in-memory MP4 buffer', async () => {
    const sink = new MediabunnyClientSink();
    const width = 160;
    const height = 120;
    const fps = 30;

    await sink.initialize({
      width,
      height,
      fps,
      totalFrames: 3,
      durationSeconds: 0.1,
    });

    const dummyRgba = new Uint8Array(width * height * 4).fill(200);

    // Consume 3 frames
    await sink.consumeFrame(0, dummyRgba);
    await sink.consumeFrame(1, dummyRgba);
    await sink.consumeFrame(2, dummyRgba);

    const result = await sink.finalize();
    expect(result.framesConsumed).toBe(3);
    expect(result.stats?.encoder).toBe('MediabunnyClientSink');
    expect(result.stats?.inMemoryBufferSize).toBeGreaterThan(0);
  });
});
