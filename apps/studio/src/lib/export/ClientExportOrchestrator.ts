import { MediabunnyClientSink } from '@acc/core-web';
import { IRMasterRenderer } from '@acc/ir';
import type { IRState } from '../ir/irState';
import { ExportWorkerBridge } from '../../renderer/workers/ExportWorkerBridge';

export interface ClientExportSinkLike {
  initialize(config: {
    width: number;
    height: number;
    fps: number;
    format: 'mp4';
    codec: string;
    videoBitrate: number;
    enableAudio: boolean;
  }): Promise<void>;
  consumeFrame(frameIndex: number, rgba: Uint8Array): Promise<void>;
  finalize(audioMixResult?: unknown): Promise<{
    framesConsumed?: number;
    fileSizeBytes?: number;
    buffer?: Uint8Array | ArrayBuffer | null;
  }>;
  getBuffer?(): Uint8Array | ArrayBuffer | null;
}

export interface ClientExportOptions {
  irState: IRState;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  videoBitrate?: number;
  codec?: string;
  yieldEveryNFrames?: number;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
  sinkFactory?: () => ClientExportSinkLike;
}

export interface ClientExportResult {
  cancelled: boolean;
  framesConsumed: number;
  fileSizeBytes: number;
  buffer: Uint8Array | ArrayBuffer | Blob | null;
}

/**
 * Yields control back to the browser main thread so React UI state updates
 * (progress bar, Cancel Export button clicks, animations) can flush without
 * stuttering the tab.
 */
export async function yieldToMainThread(): Promise<void> {
  if (typeof (globalThis as any).scheduler !== 'undefined' && typeof (globalThis as any).scheduler.yield === 'function') {
    await (globalThis as any).scheduler.yield();
  } else {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * Triggers a client-side browser download for an exported MP4 buffer or OPFS Blob.
 */
export function downloadExportedMp4(
  exportBuffer: Uint8Array | ArrayBuffer | Blob,
  filename = `video-ir-export-${Date.now()}.mp4`
): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blob =
    exportBuffer instanceof Blob
      ? exportBuffer
      : new Blob([exportBuffer instanceof Uint8Array ? exportBuffer : new Uint8Array(exportBuffer)], {
        type: 'video/mp4',
      });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Enterprise Non-Blocking Client Export Orchestrator.
 * Delegates the full video rendering, modifier preflight, and audio mixdown to
 * IRMasterRenderer via a dedicated Web Worker (ExportWorkerBridge) with OPFS scratch streaming,
 * or runs an isomorphic in-process fallback when Web Workers are unavailable.
 */
export class ClientExportOrchestrator {
  static async exportToMp4(options: ClientExportOptions): Promise<ClientExportResult> {
    const {
      irState,
      width,
      height,
      fps,
      totalFrames,
      videoBitrate = 4_000_000,
      codec = 'avc1.42E01E',
      signal,
      onProgress,
      sinkFactory,
    } = options;

    onProgress?.(0);

    if (signal?.aborted) {
      return {
        cancelled: true,
        framesConsumed: 0,
        fileSizeBytes: 0,
        buffer: null,
      };
    }

    // 1. Primary Path: Dedicated Web Worker running IRMasterRenderer + MediabunnyClientSink
    if (typeof Worker !== 'undefined' && !sinkFactory && irState.timeline) {
      try {
        const bridge = new ExportWorkerBridge();
        return await bridge.export(options);
      } catch (workerErr) {
        console.warn('[ClientExportOrchestrator] Web Worker export failed, falling back to in-process IRMasterRenderer:', workerErr);
      }
    }

    // 2. Fallback Path: In-process IRMasterRenderer execution (e.g. Node tests or Worker-restricted envs)
    let opfsFileHandle: FileSystemFileHandle | null = null;
    let opfsWritable: FileSystemWritableFileStream | undefined = undefined;

    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.getDirectory === 'function'
    ) {
      try {
        const root = await navigator.storage.getDirectory();
        const dir = await root.getDirectoryHandle('acc_content_cache', { create: true });
        const scratchName = `export_${Date.now()}.mp4`;
        opfsFileHandle = await dir.getFileHandle(scratchName, { create: true });
        opfsWritable = await opfsFileHandle.createWritable();
      } catch {}
    }

    const sink: ClientExportSinkLike = sinkFactory ? sinkFactory() : new MediabunnyClientSink();
    await (sink as any).initialize({
      width,
      height,
      fps,
      format: 'mp4',
      codec,
      videoBitrate,
      enableAudio: true,
      writableStream: opfsWritable,
    });

    if (!irState.timeline) {
      throw new Error('[ClientExportOrchestrator] Timeline is not initialized');
    }

    const masterRenderer = new IRMasterRenderer(irState.timeline, 42);

    const renderResult = await masterRenderer.render({
      engine: 'mediabunny-client' as any,
      sink: sink as any,
      signal,
      yieldInterval: 4,
      onProgress: ({ percent }) => onProgress?.(percent),
    });

    if (signal?.aborted) {
      if (typeof (sink as any).dispose === 'function') {
        await (sink as any).dispose();
      }
      return {
        cancelled: true,
        framesConsumed: renderResult.totalFrames || 0,
        fileSizeBytes: 0,
        buffer: null,
      };
    }

    let exportBuffer: Uint8Array | ArrayBuffer | Blob | null = null;
    let fileSizeBytes = renderResult.sinkResult?.fileSizeBytes || 0;

    if (opfsFileHandle) {
      try {
        const opfsFile = await opfsFileHandle.getFile();
        exportBuffer = opfsFile;
        fileSizeBytes = opfsFile.size;
      } catch {}
    }

    if (!exportBuffer) {
      exportBuffer = (sink.getBuffer?.() || null) as any;
      if (!fileSizeBytes && exportBuffer && 'byteLength' in exportBuffer) {
        fileSizeBytes = exportBuffer.byteLength;
      }
    }

    return {
      cancelled: false,
      framesConsumed: renderResult.totalFrames || totalFrames,
      fileSizeBytes,
      buffer: exportBuffer,
    };
  }
}
