import type { ClientExportOptions, ClientExportResult } from '../../lib/export/ClientExportOrchestrator';

export class ExportWorkerBridge {
  private worker: Worker | null = null;
  private currentExportId: string | null = null;

  public async export(
    options: ClientExportOptions
  ): Promise<ClientExportResult> {
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
    } = options;

    if (!irState.timeline) {
      throw new Error('[ExportWorkerBridge] Timeline is not initialized');
    }

    const exportId = `export_${Date.now()}`;
    this.currentExportId = exportId;

    return new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(new URL('./export.worker.ts', import.meta.url), {
          type: 'module',
        });
      } catch (err) {
        return reject(new Error(`Failed to instantiate export worker: ${err}`));
      }

      const cleanup = () => {
        if (this.worker) {
          this.worker.terminate();
          this.worker = null;
        }
        this.currentExportId = null;
      };

      if (signal) {
        signal.addEventListener('abort', () => {
          if (this.worker && this.currentExportId === exportId) {
            this.worker.postMessage({ type: 'CANCEL_EXPORT', exportId });
            cleanup();
            resolve({
              cancelled: true,
              framesConsumed: 0,
              fileSizeBytes: 0,
              buffer: null,
            });
          }
        });
      }

      this.worker.onmessage = async (event) => {
        const data = event.data;
        if (!data || data.exportId !== exportId) return;

        switch (data.type) {
          case 'EXPORT_PROGRESS':
            onProgress?.(data.percent);
            break;

          case 'EXPORT_CANCELLED':
            cleanup();
            resolve({
              cancelled: true,
              framesConsumed: 0,
              fileSizeBytes: 0,
              buffer: null,
            });
            break;

          case 'EXPORT_ERROR':
            cleanup();
            reject(new Error(data.error));
            break;

          case 'EXPORT_COMPLETE': {
            onProgress?.(100);
            cleanup();
            resolve({
              cancelled: false,
              framesConsumed: totalFrames,
              fileSizeBytes: data.fileSizeBytes || (data.buffer?.byteLength ?? 0),
              buffer: data.buffer || null,
            });
            break;
          }
        }
      };

      this.worker.onerror = (err) => {
        cleanup();
        reject(new Error(`Export worker crashed: ${err.message}`));
      };

      // Kick off export
      this.worker.postMessage({
        type: 'START_EXPORT',
        exportId,
        timeline: irState.timeline,
        options: {
          width,
          height,
          fps,
          totalFrames,
          videoBitrate,
          codec,
        },
      });
    });
  }
}
