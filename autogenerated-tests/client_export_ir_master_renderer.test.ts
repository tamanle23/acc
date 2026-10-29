import { describe, it, expect, beforeEach } from 'bun:test';
import {
  UniversalCanvasProvider,
  ContentCacheRegistry,
  MediaEngineRegistry,
  NativeResourceManager,
} from '../packages/core-isomorphic/src';
import { NapiCanvasAdapter, NativeFileCacheStrategy } from '../packages/core/src';
import {
  IRMasterRenderer,
  type ResolvedTimeline,
  type ResolvedTrack,
  type ResolvedSequence,
  type IIRFrameSink,
  type SinkFinalizeResult,
} from '../packages/ir/src';
import { ClientExportOrchestrator } from '../apps/studio/src/lib/export/ClientExportOrchestrator';

class MockTestExportSink implements IIRFrameSink {
  public initialized = false;
  public consumedFrames: number[] = [];
  public finalized = false;
  public disposed = false;
  private buffer = new Uint8Array([1, 2, 3, 4]);

  public async initialize(): Promise<void> {
    this.initialized = true;
  }

  public async consumeFrame(frameIndex: number, rgba: Uint8Array): Promise<void> {
    this.consumedFrames.push(frameIndex);
  }

  public getBuffer(): ArrayBuffer {
    return this.buffer.buffer;
  }

  public async finalize(): Promise<SinkFinalizeResult> {
    this.finalized = true;
    return {
      framesConsumed: this.consumedFrames.length,
      fileSizeBytes: this.buffer.byteLength,
      buffer: this.buffer.buffer,
    };
  }

  public async dispose(): Promise<void> {
    this.disposed = true;
  }
}

describe('Iteration 47: IRMasterRenderer Studio Export Integration', () => {
  beforeEach(async () => {
    UniversalCanvasProvider.registerAdapter(new NapiCanvasAdapter(), true);
    if (!ContentCacheRegistry.hasStrategy('native-file')) {
      ContentCacheRegistry.register(new NativeFileCacheStrategy({ maxBytes: 10 * 1024 * 1024 }), true);
    }
    ContentCacheRegistry.setDefault('native-file');
    NativeResourceManager.getInstance().clear();
  });

  it('ClientExportOrchestrator delegates export to IRMasterRenderer without placeholder fallback', async () => {
    const sequences: ResolvedSequence[] = [
      {
        id: 'seq-1',
        type: 'image',
        assetId: 'asset-image-1',
        startFrame: 0,
        endFrame: 5,
        durationFrames: 5,
      },
    ];

    const track: ResolvedTrack = {
      id: 'track-1',
      type: 'video',
      sequences,
      blendMode: 'normal',
      opacity: 1.0,
    };

    const tracks = new Map<string, ResolvedTrack>();
    tracks.set(track.id, track);

    // Provide a valid 1x1 png in data: URI format
    const samplePngDataUri =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const timeline: ResolvedTimeline = {
      meta: {
        version: '1.0.0',
        canvasSize: { w: 320, h: 180 },
        globalFps: 30,
      },
      totalFrames: 5,
      durationSeconds: 5 / 30,
      tracks,
      sequences: new Map([['seq-1', sequences[0]]]),
      assets: {
        'asset-image-1': {
          id: 'asset-image-1',
          type: 'image',
          src: samplePngDataUri,
        },
      },
    };

    let sinkRef: MockTestExportSink | null = null;
    const progressRecords: number[] = [];

    const result = await ClientExportOrchestrator.exportToMp4({
      irState: {
        timeline,
        doc: {
          assets: timeline.assets,
        },
      } as any,
      width: 320,
      height: 180,
      fps: 30,
      totalFrames: 5,
      onProgress: (p) => progressRecords.push(p),
      sinkFactory: () => {
        sinkRef = new MockTestExportSink();
        return sinkRef;
      },
    });

    expect(result.cancelled).toBe(false);
    expect(result.framesConsumed).toBe(5);
    expect(sinkRef).not.toBeNull();
    expect(sinkRef!.initialized).toBe(true);
    expect(sinkRef!.consumedFrames.length).toBe(5);
    expect(sinkRef!.finalized).toBe(true);
    expect(progressRecords.length).toBeGreaterThan(0);
    expect(progressRecords[progressRecords.length - 1]).toBe(100);
  });

  it('ClientExportOrchestrator aborts cleanly when AbortSignal is triggered', async () => {
    const sequences: ResolvedSequence[] = [
      {
        id: 'seq-long',
        type: 'video',
        startFrame: 0,
        endFrame: 100,
        durationFrames: 100,
      },
    ];

    const tracks = new Map<string, ResolvedTrack>([
      [
        'track-1',
        {
          id: 'track-1',
          type: 'video',
          sequences,
          blendMode: 'normal',
          opacity: 1.0,
        },
      ],
    ]);

    const timeline: ResolvedTimeline = {
      meta: {
        version: '1.0.0',
        canvasSize: { w: 320, h: 180 },
        globalFps: 30,
      },
      totalFrames: 100,
      durationSeconds: 100 / 30,
      tracks,
      sequences: new Map([['seq-long', sequences[0]]]),
      assets: {},
    };

    const abortController = new AbortController();
    let sinkRef: MockTestExportSink | null = null;

    const exportPromise = ClientExportOrchestrator.exportToMp4({
      irState: { timeline } as any,
      width: 320,
      height: 180,
      fps: 30,
      totalFrames: 100,
      signal: abortController.signal,
      onProgress: ({ currentFrame }: any) => {
        if (currentFrame >= 10) {
          abortController.abort();
        }
      },
      sinkFactory: () => {
        sinkRef = new MockTestExportSink();
        return sinkRef;
      },
    });

    // Abort after small delay
    setTimeout(() => abortController.abort(), 25);
    const result = await exportPromise;

    expect(result.cancelled).toBe(true);
    expect(result.buffer).toBeNull();
  });
});
