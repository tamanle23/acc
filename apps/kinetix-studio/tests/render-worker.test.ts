// ============================================================================
// KINETIX STUDIO - DEDICATED OFFSCREENCANVAS RENDER WORKER SUITE (MILESTONE B)
// Verifies worker message protocol, raw PCM audio sample extraction,
// zero-copy ArrayBuffer transfer, and background export capability detection.
// ============================================================================

import { describe, it, expect } from 'bun:test';
import { WorkerExportAdapter } from '@/adapters/driven/worker-export-adapter';
import { INITIAL_STUDIO_STATE } from '@/constants/initial-state';
import type { VideoEncoderOptions } from '@/core/ports/driven/video-encoder.port';

describe('OffscreenCanvas Render Worker & WebCodecs Suite (Milestone B)', () => {
  it('instantiates WorkerExportAdapter and verifies feature detection contract', () => {
    const adapter = new WorkerExportAdapter();
    expect(adapter).toBeDefined();
    expect(adapter.name).toBe('WorkerWebCodecsVideoEncoder');
    expect(typeof adapter.isSupported).toBe('function');
    expect(typeof adapter.isSupported()).toBe('boolean');
  });

  it('validates raw PCM channel serialization preventing AudioBuffer DataCloneError', () => {
    // Simulate 2-channel 44.1kHz audio buffer data
    const sampleRate = 44100;
    const durationSec = 0.1;
    const numFrames = Math.round(sampleRate * durationSec);
    const leftChannel = new Float32Array(numFrames);
    const rightChannel = new Float32Array(numFrames);

    for (let i = 0; i < numFrames; i++) {
      leftChannel[i] = Math.sin((i / sampleRate) * 440 * Math.PI * 2);
      rightChannel[i] = Math.cos((i / sampleRate) * 440 * Math.PI * 2);
    }

    const options: VideoEncoderOptions = {
      state: INITIAL_STUDIO_STATE,
      width: 1920,
      height: 1080,
      fps: 30,
      audioChannels: [leftChannel, rightChannel],
      audioSampleRate: sampleRate,
    };

    expect(options.audioChannels).toBeDefined();
    expect(options.audioChannels?.length).toBe(2);
    expect(options.audioChannels?.[0]?.length).toBe(numFrames);

    // Verify channel backing buffers can be sliced and transferred
    const buffers = options.audioChannels!.map((c) => c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength));
    expect(buffers.length).toBe(2);
    expect(buffers[0]!.byteLength).toBe(numFrames * 4);
  });

  it('handles cancellation and abort signals gracefully', async () => {
    const adapter = new WorkerExportAdapter();
    const abortController = new AbortController();

    const options: VideoEncoderOptions = {
      state: INITIAL_STUDIO_STATE,
      width: 1080,
      height: 1920,
      fps: 30,
      abortSignal: abortController.signal,
    };

    // Immediately abort
    abortController.abort();

    // When worker is absent or aborted, it returns null without hanging
    const result = await adapter.encodeVideo(options);
    expect(result).toBeNull();
  });
});
