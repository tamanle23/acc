import { describe, it, expect, spyOn } from 'bun:test';
import { MediabunnyWorkerReader } from '../apps/studio/src/renderer/workers/MediabunnyWorkerReader';
import { WebCodecsDecoderPool } from '../apps/studio/src/renderer/workers/WebCodecsDecoderPool';

describe('MediabunnyWorkerReader - Negative Caching & Cooldown', () => {
  it('enters cooldown on initialization failure and suppresses retry storm', async () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});

    // Use a non-existent cache URI to fail instantly without triggering Mediabunny UrlSource network retry delays
    const reader = new MediabunnyWorkerReader('cache:nonexistent-video-clip', {
      assetId: 'test-invalid-video',
    });

    expect(reader.getIsInitialized()).toBe(false);
    expect(reader.isFailed()).toBe(false);

    // First attempt: fails and enters cooldown
    const firstAttempt = await reader.init();
    expect(firstAttempt).toBe(false);
    expect(reader.isFailed()).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // Second attempt within cooldown: returns false immediately, 0 additional warnings
    const secondAttempt = await reader.init();
    expect(secondAttempt).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // reacquireHardwareDecoder() within cooldown: returns false immediately, 0 additional warnings
    const reacquireAttempt = await reader.reacquireHardwareDecoder();
    expect(reacquireAttempt).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it('WebCodecsDecoderPool skips acquireLease when reader is in failed cooldown', async () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    const pool = WebCodecsDecoderPool.getInstance();

    const reader = new MediabunnyWorkerReader('cache:nonexistent-pool-video', {
      assetId: 'test-pool-failed',
    });

    pool.register('test-pool-failed', reader);

    // Trigger initial failure
    await reader.init();
    expect(reader.isFailed()).toBe(true);

    const warnCountBefore = warnSpy.mock.calls.length;

    // acquireLease should fast-return false without retrying reacquireHardwareDecoder
    const leaseOk = await pool.acquireLease('test-pool-failed', 100);
    expect(leaseOk).toBe(false);
    expect(warnSpy.mock.calls.length).toBe(warnCountBefore);

    pool.unregister('test-pool-failed');
    warnSpy.mockRestore();
  });
});
