// ============================================================================
// KINETIX STUDIO - DRIVEN ADAPTER: BROWSER DOWNLOAD TRANSPORT (ECMA-429)
// Enforces single-point download ownership and avoids multi-download blocking.
// ============================================================================

import type { IDownloadTransportPort } from '@/core/ports/driven/download-transport.port';

export class BrowserDownloadTransportAdapter implements IDownloadTransportPort {
  /**
   * Dispatches a single, guaranteed-clean DOM download trigger.
   */
  public downloadBlob(blob: Blob, filename: string): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();

    // Defer cleanup to allow browser download initiation
    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 1500);
  }

  /**
   * Saves to a FileSystemWritableFileStream if a FileSystemFileHandle is provided.
   */
  public async saveToFileHandle(blob: Blob, fileHandle: unknown): Promise<boolean> {
    if (!fileHandle || typeof fileHandle !== 'object') {
      return false;
    }

    const handle = fileHandle as { createWritable?: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> };
    if (typeof handle.createWritable !== 'function') {
      return false;
    }

    try {
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      console.warn('Failed writing to FileSystemFileHandle:', err);
      return false;
    }
  }
}
