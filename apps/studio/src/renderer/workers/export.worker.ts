// Defensive worker environment polyfill to avoid runtime errors from Vite HMR / React Refresh
if (typeof self !== 'undefined' && typeof (self as any).window === 'undefined') {
  (self as any).window = self;
}

import { bootstrapCoreWeb, MediabunnyClientStrategy, MediabunnyClientSink } from '@acc/core-web';
import { registerCoreModifierPlugins, IRMasterRenderer } from '@acc/ir';
import { MediaEngineRegistry } from '@acc/core-isomorphic';

// Bootstrap client runtime (UniversalCanvasProvider WebCanvasAdapter, ContentCacheRegistry OPFS/IndexedDB, MediaEngineRegistry)
bootstrapCoreWeb();
registerCoreModifierPlugins();

// Ensure MediabunnyClientStrategy is registered in worker context
if (!MediaEngineRegistry.has('mediabunny-client')) {
  MediaEngineRegistry.register(new MediabunnyClientStrategy());
}

export interface ExportWorkerInitMessage {
  type: 'START_EXPORT';
  exportId: string;
  timeline: any;
  options: {
    width: number;
    height: number;
    fps: number;
    totalFrames: number;
    videoBitrate?: number;
    codec?: string;
    writableStream?: FileSystemWritableFileStream;
  };
}

export interface ExportWorkerCancelMessage {
  type: 'CANCEL_EXPORT';
  exportId: string;
}

export type ExportWorkerInMessage = ExportWorkerInitMessage | ExportWorkerCancelMessage;

let activeAbortController: AbortController | null = null;
let activeSink: MediabunnyClientSink | null = null;

self.onmessage = async (event: MessageEvent<ExportWorkerInMessage>) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'CANCEL_EXPORT') {
    if (activeAbortController) {
      activeAbortController.abort();
    }
    if (activeSink) {
      try {
        await activeSink.dispose();
      } catch {}
    }
    self.postMessage({ type: 'EXPORT_CANCELLED', exportId: data.exportId });
    return;
  }

  if (data.type === 'START_EXPORT') {
    const { exportId, timeline, options } = data;
    const {
      width,
      height,
      fps,
      totalFrames,
      videoBitrate = 4_000_000,
      codec = 'avc1.42E01E',
      writableStream,
    } = options;

    activeAbortController = new AbortController();
    const sink = new MediabunnyClientSink();
    activeSink = sink;

    try {
      await sink.initialize({
        width,
        height,
        fps,
        format: 'mp4',
        codec,
        videoBitrate,
        enableAudio: true,
        writableStream,
      });

      const masterRenderer = new IRMasterRenderer(timeline, 42);

      const renderResult = await masterRenderer.render({
        engine: 'mediabunny-client' as any,
        sink,
        signal: activeAbortController.signal,
        yieldInterval: 4,
        onProgress: ({ percent, currentFrame, totalFrames: total }) => {
          self.postMessage({
            type: 'EXPORT_PROGRESS',
            exportId,
            percent,
            currentFrame,
            totalFrames: total,
          });
        },
      });

      if (activeAbortController.signal.aborted) {
        self.postMessage({ type: 'EXPORT_CANCELLED', exportId });
        return;
      }

      const sinkBuffer = sink.getBuffer?.();
      const sinkResult = renderResult.sinkResult;
      const fileSizeBytes = sinkResult?.fileSizeBytes || sinkBuffer?.byteLength || 0;

      // Transfer sinkBuffer to main thread if available
      if (sinkBuffer && sinkBuffer instanceof ArrayBuffer) {
        self.postMessage(
          {
            type: 'EXPORT_COMPLETE',
            exportId,
            fileSizeBytes: sinkBuffer.byteLength,
            buffer: sinkBuffer,
          },
          [sinkBuffer]
        );
      } else {
        self.postMessage({
          type: 'EXPORT_COMPLETE',
          exportId,
          fileSizeBytes,
          buffer: sinkBuffer,
        });
      }
    } catch (err: any) {
      self.postMessage({
        type: 'EXPORT_ERROR',
        exportId,
        error: err?.message || String(err),
      });
    } finally {
      activeSink = null;
      activeAbortController = null;
    }
  }
};
