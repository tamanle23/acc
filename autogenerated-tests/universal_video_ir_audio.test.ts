import { describe, expect, test } from 'bun:test';
import fs from 'fs';
import path from 'path';
import {
  FFIAudioDecoder,
  FFmpegManager,
  initFFI,
} from '../packages/core';
import {
  DynamicAudioDuckingEngine,
  DecoupledAudioMixer,
  RelationalDAGCompiler,
  IRMasterRenderer,
  StoryConfigToUniversalIRAdapter,
} from '../packages/ir';

describe('Pillar 2: Universal Video IR Audio Mixing & Master Voiceover Enhancements', () => {
  test('FFIAudioDecoder decodes audio into standardized 48kHz Stereo Float32 PCM', async () => {
    await FFmpegManager.prepare();
    initFFI();

    // Find sample audio (e.g. from sample-story)
    const sampleDir = path.resolve('sample-story');
    const audioCandidates = ['audio_1.mp3', 'audio_1.wav', 'bgm.mp3'];
    let targetAudio: string | null = null;

    for (const f of audioCandidates) {
      const p = path.join(sampleDir, f);
      if (fs.existsSync(p)) {
        targetAudio = p;
        break;
      }
    }

    if (targetAudio) {
      const decoded = await FFIAudioDecoder.decodeToPCM(targetAudio, 48000, 2);
      expect(decoded).not.toBeNull();
      expect(decoded!.sampleRate).toBe(48000);
      expect(decoded!.channels).toBe(2);
      expect(decoded!.data.length).toBeGreaterThan(0);
      expect(decoded!.totalSamplesPerChannel).toBeGreaterThan(0);
      expect(decoded!.durationSeconds).toBeGreaterThan(0);
    }
  });

  test('DynamicAudioDuckingEngine calculates attack, hold, and release curve from dialogue', () => {
    const sampleRate = 48000;
    const channels = 2;
    const durationSeconds = 2.0;
    const totalSamples = Math.round(durationSeconds * sampleRate);

    // Synthetic dialogue track: 0.5s silence, 0.5s dialogue, 1.0s silence
    const voicePcm = new Float32Array(totalSamples * channels);
    const speechStart = Math.round(0.5 * sampleRate);
    const speechEnd = Math.round(1.0 * sampleRate);

    for (let s = speechStart; s < speechEnd; s++) {
      voicePcm[s * channels] = 0.5; // Dialogue active
      voicePcm[s * channels + 1] = 0.5;
    }

    const envelope = DynamicAudioDuckingEngine.generateEnvelope(voicePcm, totalSamples, {
      sampleRate,
      channels,
      attenuationDb: -18.0,
      thresholdDb: -30.0,
      attackMs: 15,
      holdMs: 100,
      releaseMs: 300,
    });

    expect(envelope.length).toBe(totalSamples);
    // Before dialogue starts: full gain (1.0)
    expect(envelope[0]).toBeCloseTo(1.0, 1);
    // During dialogue: attenuated (~0.125 for -18dB)
    const midSpeech = Math.round(0.75 * sampleRate);
    expect(envelope[midSpeech]).toBeLessThan(0.3);
    // Well after dialogue release (>1.5s): recovers back to 1.0
    const endSample = totalSamples - 1;
    expect(envelope[endSample]).toBeGreaterThan(0.9);
  });

  test('DecoupledAudioMixer mixes voiceover, BGM with loop/fade, SFX with spatial pan and soft limiter', async () => {
    const sampleStoryPath = path.resolve('sample-story', 'story-config.json');
    if (!fs.existsSync(sampleStoryPath)) return;

    const raw = JSON.parse(fs.readFileSync(sampleStoryPath, 'utf-8'));
    const irDoc = StoryConfigToUniversalIRAdapter.adapt(raw);
    const compiler = new RelationalDAGCompiler();
    const timeline = await compiler.compile(irDoc);

    const mixer = new DecoupledAudioMixer(48000, 2);
    const result = await mixer.mix(timeline, { baseDir: path.dirname(sampleStoryPath) });

    expect(result.totalSamples).toBeGreaterThan(0);
    expect(result.sampleRate).toBe(48000);
    expect(result.channels).toBe(2);
    expect(result.buffer.length).toBe(result.totalSamples * 2);

    // Verify soft-clipping limiter: no samples exceed [-1.0, 1.0]
    for (let i = 0; i < Math.min(10000, result.buffer.length); i++) {
      expect(Math.abs(result.buffer[i])).toBeLessThanOrEqual(1.0);
    }
  });
});
