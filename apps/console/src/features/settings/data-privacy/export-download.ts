import { springApiClient } from '@/features/spring-auth';

type SaveFilePicker = (options: {
  suggestedName: string;
  types?: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<{
  createWritable: () => Promise<{
    write: (chunk: Uint8Array) => Promise<void>;
    close: () => Promise<void>;
    abort: () => Promise<void>;
  }>;
}>;

export type ExportDownloadMode = 'streamed-to-disk' | 'buffered';

function getSavePicker(): SaveFilePicker | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Downloads the GDPR Art. 20 archive from the non-blocking /export-stream endpoint.
 * Where the File System Access API exists, chunks are written straight to disk so the browser
 * never holds the whole archive in memory; otherwise falls back to a buffered blob download.
 * Auth/tenant/trace headers come from springApiClient interceptors (axios fetch adapter).
 */
export async function downloadTenantExport(tenantId: string): Promise<ExportDownloadMode> {
  const path = `/v1/metadata/tenants/${encodeURIComponent(tenantId)}/export-stream`;
  const filename = `tenant_export_${tenantId}_${Date.now()}.zip`;
  const picker = getSavePicker();

  if (picker) {
    // Picker must be opened from the user gesture, before the long-running request.
    const handle = await picker({
      suggestedName: filename,
      types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
    });
    const writable = await handle.createWritable();
    try {
      const res = await springApiClient.get<ReadableStream<Uint8Array>>(path, {
        responseType: 'stream',
        adapter: 'fetch',
        timeout: 0,
      });
      const reader = res.data.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) await writable.write(value);
      }
      await writable.close();
      return 'streamed-to-disk';
    } catch (err) {
      await writable.abort().catch(() => undefined);
      throw err;
    }
  }

  const res = await springApiClient.get<Blob>(path, { responseType: 'blob', timeout: 0 });
  triggerBlobDownload(new Blob([res.data], { type: 'application/zip' }), filename);
  return 'buffered';
}
