import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { MediabunnyClientSink } from '../packages/core/src/media-engine/sinks/MediabunnyClientSink';

describe('MediabunnyClientSink Audio-Video WebCodecs Muxing', () => {
  let origAudioEncoder: any;
  let origAudioData: any;
  let origEncodedAudioChunk: any;
  let origEncodedVideoChunk: any;
  let origVideoEncoder: any;
  let origVideoFrame: any;

  beforeAll(() => {
    origAudioEncoder = (globalThis as any).AudioEncoder;
    origAudioData = (globalThis as any).AudioData;
    origEncodedAudioChunk = (globalThis as any).EncodedAudioChunk;
    origEncodedVideoChunk = (globalThis as any).EncodedVideoChunk;
    origVideoEncoder = (globalThis as any).VideoEncoder;
    origVideoFrame = (globalThis as any).VideoFrame;

    // Polyfill WebCodecs mocks for Bun headless testing
    class MockAudioEncoder {
      private _output: any;
      static isConfigSupported() {
        return Promise.resolve({ supported: true });
      }
      constructor(init: any) {
        this._output = init.output;
      }
      configure() {}
      encode(data: any) {
        if (this._output) {
          const chunk = new MockEncodedAudioChunk({
            type: 'key',
            timestamp: data.timestamp,
            duration: data.duration,
            data: new Uint8Array(64),
          });
          this._output(chunk, {
            decoderConfig: {
              codec: 'mp4a.40.2',
              sampleRate: 48000,
              numberOfChannels: 2,
              description: new Uint8Array([0x11, 0x90]),
            },
          });
        }
      }
      flush() {
        return Promise.resolve();
      }
      close() {}
    }

    class MockAudioData {
      public format: string;
      public sampleRate: number;
      public numberOfFrames: number;
      public numberOfChannels: number;
      public timestamp: number;
      public duration: number;
      constructor(init: any) {
        this.format = init.format;
        this.sampleRate = init.sampleRate;
        this.numberOfFrames = init.numberOfFrames;
        this.numberOfChannels = init.numberOfChannels;
        this.timestamp = init.timestamp;
        this.duration = init.numberOfFrames / init.sampleRate;
      }
      close() {}
    }

    class MockEncodedAudioChunk {
      public type: string;
      public timestamp: number;
      public duration: number;
      public byteLength: number;
      private _data: Uint8Array;
      constructor(init: any) {
        this.type = init.type;
        this.timestamp = init.timestamp;
        this.duration = init.duration;
        this.byteLength = init.data.byteLength;
        this._data = init.data;
      }
      copyTo(dest: Uint8Array) {
        dest.set(this._data);
      }
    }

    class MockVideoEncoder {
      private _output: any;
      static isConfigSupported() {
        return Promise.resolve({ supported: true });
      }
      constructor(init: any) {
        this._output = init.output;
      }
      configure() {}
      encode(frame: any) {
        if (this._output) {
          const chunk = new MockEncodedVideoChunk({
            type: 'key',
            timestamp: frame.timestamp,
            duration: frame.duration,
            data: new Uint8Array(128),
          });
          this._output(chunk, {
            decoderConfig: {
              codec: 'avc1.42E01E',
              codedWidth: 160,
              codedHeight: 120,
              description: new Uint8Array([0x01, 0x42, 0xe0, 0x1e]),
            },
          });
        }
      }
      flush() {
        return Promise.resolve();
      }
      close() {}
    }

    class MockEncodedVideoChunk {
      public type: string;
      public timestamp: number;
      public duration: number;
      public byteLength: number;
      private _data: Uint8Array;
      constructor(init: any) {
        this.type = init.type;
        this.timestamp = init.timestamp;
        this.duration = init.duration;
        this.byteLength = init.data.byteLength;
        this._data = init.data;
      }
      copyTo(dest: Uint8Array) {
        dest.set(this._data);
      }
    }

    class MockVideoFrame {
      public timestamp: number;
      public duration: number;
      constructor(data: any, init: any) {
        this.timestamp = init?.timestamp ?? 0;
        this.duration = init?.duration ?? 0;
      }
      close() {}
    }

    (globalThis as any).AudioEncoder = MockAudioEncoder;
    (globalThis as any).AudioData = MockAudioData;
    (globalThis as any).EncodedAudioChunk = MockEncodedAudioChunk;
    (globalThis as any).EncodedVideoChunk = MockEncodedVideoChunk;
    (globalThis as any).VideoEncoder = MockVideoEncoder;
    (globalThis as any).VideoFrame = MockVideoFrame;
  });

  afterAll(() => {
    (globalThis as any).AudioEncoder = origAudioEncoder;
    (globalThis as any).AudioData = origAudioData;
    (globalThis as any).EncodedAudioChunk = origEncodedAudioChunk;
    (globalThis as any).EncodedVideoChunk = origEncodedVideoChunk;
    (globalThis as any).VideoEncoder = origVideoEncoder;
    (globalThis as any).VideoFrame = origVideoFrame;
  });

  it('should initialize with video track and AAC audio track by default', async () => {
    const sink = new MediabunnyClientSink();
    await sink.initialize({
      width: 160,
      height: 120,
      fps: 30,
      totalFrames: 10,
      durationSeconds: 10 / 30,
      enableAudio: true,
    });

    expect(sink.id).toBe('mediabunny-client-sink');
  });

  it('should consume video frames and finalize with Float32 audio mix result', async () => {
    const sink = new MediabunnyClientSink();
    const width = 160;
    const height = 120;
    const fps = 30;
    const totalFrames = 5;

    await sink.initialize({
      width,
      height,
      fps,
      totalFrames,
      durationSeconds: totalFrames / fps,
      enableAudio: true,
    });

    const testRgba = new Uint8Array(width * height * 4).fill(128);

    for (let f = 0; f < totalFrames; f++) {
      await sink.consumeFrame(f, testRgba);
    }

    // Synthesize 48kHz stereo audio buffer
    const sampleRate = 48000;
    const durationSeconds = totalFrames / fps;
    const totalSamples = Math.floor(durationSeconds * sampleRate);
    const pcmLeft = new Float32Array(totalSamples);
    const pcmRight = new Float32Array(totalSamples);

    for (let i = 0; i < totalSamples; i++) {
      const s = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
      pcmLeft[i] = s;
      pcmRight[i] = s;
    }

    const result = await sink.finalize({
      totalSamples,
      sampleRate,
      channels: 2,
      durationSeconds,
      buffer: new Float32Array(totalSamples * 2),
      pcmLeft,
      pcmRight,
    });

    expect(result.framesConsumed).toBe(totalFrames);
    expect(result.buffer).toBeDefined();
    expect(result.fileSizeBytes).toBeGreaterThan(0);
  });
});
